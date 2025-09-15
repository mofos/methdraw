import {
	Dispatch,
	createContext,
	useContext,
	useState,
	useEffect,
	useRef,
	useLayoutEffect,
} from 'react'
import { Navigate } from 'react-router-dom'
import OpenAI from 'openai'
import { getAnalysisPrompt, getPromptDescriptions } from './screenAnalysis'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages'
import {
	Tldraw,
	createShapeId,
	useEditor,
	useIsDarkMode,
	useValue,
	approximately,
	TLComponents,
	DefaultStylePanel,
	DefaultStylePanelContent,
	useRelevantStyles,
	Editor,
	TLStore,
	createTLStore,
} from 'tldraw'
import 'tldraw/tldraw.css'
import MarkdownRenderer from './MarkdownRenderer'
import { useUser } from '@clerk/clerk-react'
import { uiOverrides, components, customAssetUrls } from './ui-overrides'
import { ChatOverlay } from './ChatOverlay'
import { HistoryViewer } from './ChatOverlay'

// Add type declaration at the top of the file
declare global {
	interface Window {
		tldraw?: {
			getSnapshot: () => Promise<any>
		}
	}
}

interface ChatMessage {
	text: string
	sender: 'user' | 'assistant'
}

interface ConversationContext {
	screenDescription: string
	ai: string
	user: string
	timestamp: Date
	screenAnalysis?: string
}

interface ConversationLog {
	contexts: ConversationContext[]
}

interface ConversationSummary {
	roundNumber: number
	timestamp: Date
	summary: string
	context: {
		userMessages: string[]
		aiResponses: string[]
		screenAnalyses: string[]
	}
}

interface HistoryViewerProps {
	isOpen: boolean
	onClose: () => void
	logs: ConversationContext[]
	summaries: ConversationSummary[]
}

interface ChatUiContextType {
	conversationLog: React.MutableRefObject<ConversationLog>
	summaries: ConversationSummary[]
	setSummaries: React.Dispatch<React.SetStateAction<ConversationSummary[]>>
	updateConversationLog: (
		screenDescription: string,
		aiResponse: string,
		userMessage: string,
		screenAnalysis?: string
	) => void
	generateSummary: (contexts: ConversationContext[]) => Promise<void>
}

const ChatUiContext = createContext<ChatUiContextType | null>(null)

export function CustomUI() {
	const context = useContext(ChatUiContext)
	if (!context) {
		throw new Error('CustomUI must be used within a ChatUiContext.Provider')
	}
	const { conversationLog, summaries, setSummaries, updateConversationLog, generateSummary } =
		context

	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isScreenSharing, setIsScreenSharing] = useState(false)
	const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [selectedAnalysisType, setSelectedAnalysisType] = useState(getPromptDescriptions()[0])
	const [isHistoryViewerOpen, setIsHistoryViewerOpen] = useState(false)
	const chatModel = useRef<ChatOpenAI | null>(null)
	const messageHistory = useRef<BaseMessage[]>([])
	const videoRef = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		chatModel.current = new ChatOpenAI({
			openAIApiKey: '***',
			modelName: 'gpt-4.1-mini',
			temperature: 0.7,
			streaming: true,
		})
	}, [])

	useEffect(() => {
		if (videoRef.current && screenStream) {
			videoRef.current.srcObject = screenStream
		}
	}, [screenStream])

	const startScreenShare = async () => {
		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					width: { ideal: 1920 },
					height: { ideal: 1080 },
				},
			})
			setScreenStream(stream)
			setIsScreenSharing(true)

			stream.getVideoTracks()[0].onended = () => {
				stopScreenShare()
			}
		} catch (error) {
			console.error('Error starting screen share:', error)
		}
	}

	const stopScreenShare = () => {
		if (screenStream) {
			screenStream.getTracks().forEach((track) => track.stop())
			setScreenStream(null)
			setIsScreenSharing(false)
		}
	}

	const captureAndAnalyzeScreen = async () => {
		if (!screenStream || !chatModel.current) return

		setIsAnalyzing(true)
		try {
			const canvas = document.createElement('canvas')
			const video = videoRef.current
			if (!video) return

			canvas.width = video.videoWidth
			canvas.height = video.videoHeight
			const ctx = canvas.getContext('2d')
			if (!ctx) return

			ctx.drawImage(video, 0, 0)
			const base64Image = canvas.toDataURL('image/jpeg', 0.8)

			// Get the current Tldraw state
			const tldrawState = await window.tldraw?.getSnapshot()
			const tldrawJsonData = tldrawState ? JSON.stringify(tldrawState) : ''

			const systemPrompt = `You are an AI assistant specialized in analyzing the content of a Tldraw canvas. Your sole task is to identify and describe the shapes, text, and overall structure of the diagram presented in the image.

**Crucially, ignore all elements that are not part of the Tldraw canvas itself.** This includes any operating system UI, browser elements, or anything outside the drawing area. Focus exclusively on the user's drawing.

Based on the provided image and the accompanying Tldraw shape data, extract the following:

1. **Overall Diagram Type:** What kind of diagram or sketch appears to be present? (e.g., flowchart, mind map, circuit diagram, geometry sketch, freeform drawing, mathematical equation setup). If unclear, state "Unclear/Mixed."

2. **Key Elements:**
   * All distinct text labels and their approximate locations
   * All geometric shapes (e.g., circles, rectangles, diamonds) and their associated text labels (if any)
   * All connectors (arrows, lines) and which shapes they connect

3. **Inferred Relationships/Structure:** Describe how elements are connected or spatially related to form a coherent whole

4. **Completeness/Status Assessment:** Does the diagram appear to be complete for its inferred type, in progress, or potentially contain missing or misplaced elements?

Respond concisely in a structured JSON format, adhering strictly to the canvas content.`

			const userPrompt = getAnalysisPrompt(selectedAnalysisType)

			let responseText = ''
			const response = await chatModel.current.stream([
				{
					role: 'system',
					content: systemPrompt,
				},
				{
					role: 'user',
					content: [
						{ type: 'text', text: userPrompt },
						{
							type: 'image_url',
							image_url: {
								url: base64Image,
								detail: 'auto',
							},
						},
						{
							type: 'text',
							text: `Tldraw JSON Data: ${tldrawJsonData}`,
						},
					],
				},
			])

			for await (const chunk of response) {
				if (chunk.content) {
					responseText += chunk.content
					setMessages((prev) => {
						const newMessages = [...prev]
						const lastMessage = newMessages[newMessages.length - 1]
						if (lastMessage && lastMessage.sender === 'assistant') {
							lastMessage.text = responseText
						} else {
							newMessages.push({ text: responseText, sender: 'assistant' })
						}
						return newMessages
					})
				}
			}

			const aiMessage = new AIMessage(responseText)
			messageHistory.current.push(aiMessage)

			// Update conversation log with the screen analysis and base64 image
			const newLog: ConversationContext = {
				user: 'Screen Analysis',
				ai: responseText,
				timestamp: new Date(),
				screenDescription: base64Image || '',
				screenAnalysis: responseText,
			}
			updateConversationLog(base64Image, responseText, 'Screen Analysis', responseText)
		} catch (error) {
			console.error('Error analyzing screen:', error)
			setMessages((prev) => [
				...prev,
				{
				text: 'Error analyzing screen. Please try again.', 
					sender: 'assistant',
				},
			])
		} finally {
			setIsAnalyzing(false)
		}
	}

	const handleSend = async () => {
		if (!input.trim() || !chatModel.current) return

		const userMessage = input.trim()
		const humanMessage = new HumanMessage(userMessage)
		messageHistory.current.push(humanMessage)
		
		setMessages((prev) => [...prev, { text: userMessage, sender: 'user' }])
		setInput('')
		setIsLoading(true)

		try {
			// Get current screen description and analysis
			let screenDescription = ''
			let screenAnalysis = ''
			
			if (isScreenSharing && videoRef.current) {
				const canvas = document.createElement('canvas')
				canvas.width = videoRef.current.videoWidth
				canvas.height = videoRef.current.videoHeight
				const ctx = canvas.getContext('2d')
				if (ctx) {
					ctx.drawImage(videoRef.current, 0, 0)
					screenDescription = canvas.toDataURL('image/jpeg', 0.8)

					// Get the current Tldraw state
					const tldrawState = await window.tldraw?.getSnapshot()
					const tldrawJsonData = tldrawState ? JSON.stringify(tldrawState) : ''

					// Analyze the screen
					const systemPrompt = `You are an AI assistant specialized in analyzing the content of a Tldraw canvas. Your sole task is to identify and describe the shapes, text, and overall structure of the diagram presented in the image.

**Crucially, ignore all elements that are not part of the Tldraw canvas itself.** This includes any operating system UI, browser elements, or anything outside the drawing area. Focus exclusively on the user's drawing.

Based on the provided image and the accompanying Tldraw shape data, extract the following:

1. **Overall Diagram Type:** What kind of diagram or sketch appears to be present? (e.g., flowchart, mind map, circuit diagram, geometry sketch, freeform drawing, mathematical equation setup). If unclear, state "Unclear/Mixed."

2. **Key Elements:**
   * All distinct text labels and their approximate locations
   * All geometric shapes (e.g., circles, rectangles, diamonds) and their associated text labels (if any)
   * All connectors (arrows, lines) and which shapes they connect

3. **Inferred Relationships/Structure:** Describe how elements are connected or spatially related to form a coherent whole

4. **Completeness/Status Assessment:** Does the diagram appear to be complete for its inferred type, in progress, or potentially contain missing or misplaced elements?

Respond concisely in a structured JSON format, adhering strictly to the canvas content.`

					const analysisResponse = await chatModel.current.stream([
						{
							role: 'system',
							content: systemPrompt,
						},
						{
							role: 'user',
							content: [
								{ type: 'text', text: 'Analyze the current state of the Tldraw canvas.' },
								{
									type: 'image_url',
									image_url: {
										url: screenDescription,
										detail: 'auto',
									},
								},
								{
									type: 'text',
									text: `Tldraw JSON Data: ${tldrawJsonData}`,
								},
							],
						},
					])

					for await (const chunk of analysisResponse) {
						if (chunk.content) {
							screenAnalysis += chunk.content
						}
					}
				}
			}

			// Get the latest summary if available
			const latestSummary = summaries.length > 0 ? summaries[summaries.length - 1] : null

			// Prepare the context for the chat response
			const contextText = `${
				latestSummary
					? `Latest Summary (Round ${latestSummary.roundNumber}):
${latestSummary.summary}

`
					: ''
			}Previous Conversation Context:
${messageHistory.current
	.slice(-3)
	.map((msg) => {
		const timestamp = new Date().toLocaleString()
		const isHuman = msg instanceof HumanMessage
		const logEntry = conversationLog.current.contexts.find(
			(log) => log.user === msg.content || log.ai === msg.content
		)
	
	return `${timestamp} - ${isHuman ? 'User' : 'Assistant'}: ${msg.content}
${logEntry?.screenAnalysis ? `Screen Analysis: ${logEntry.screenAnalysis}` : ''}`
	})
	.join('\n\n')} 

Current Canvas State: ${screenAnalysis || 'No canvas analysis available'}

User Query: ${userMessage}`

			let responseText = ''
			const messages = [
				{
					role: 'system',
					content: `You are an AI assistant helping users with their Tldraw diagrams. You have access to:
1. The current state of their Tldraw canvas
2. The previous conversation history
3. The latest conversation summary (if available)
4. The user's current query

Provide helpful, specific responses that take into account both the visual state of their diagram and the conversation context. 
If a summary is available, use it to maintain continuity and reference previous developments.`,
				},
				...messageHistory.current.slice(-3).map((msg) => ({
					role: msg instanceof HumanMessage ? 'user' : 'assistant',
					content: msg.content,
				})),
				{
					role: 'user',
					content: contextText,
				},
			]

			// Add screen image if available
			if (screenDescription) {
				messages.push({
					role: 'user',
					content: [
						{
							type: 'image_url',
							image_url: {
								url: screenDescription,
								detail: 'auto',
							},
						},
					],
				})
			}

			const response = await chatModel.current.stream(messages)
			
			for await (const chunk of response) {
				if (chunk.content) {
					responseText += chunk.content
					setMessages((prev) => {
						const newMessages = [...prev]
						const lastMessage = newMessages[newMessages.length - 1]
						if (lastMessage && lastMessage.sender === 'assistant') {
							lastMessage.text = responseText
						} else {
							newMessages.push({ text: responseText, sender: 'assistant' })
						}
						return newMessages
					})
				}
			}

			const aiMessage = new AIMessage(responseText)
			messageHistory.current.push(aiMessage)

			// Update conversation log with the latest interaction
			const newLog: ConversationContext = {
				user: userMessage,
				ai: responseText,
				timestamp: new Date(),
				screenDescription: screenDescription || '',
				screenAnalysis,
			}
			updateConversationLog(screenDescription, responseText, userMessage, screenAnalysis)
		} catch (error) {
			console.error('Error calling chat model:', error)
			setMessages((prev) => [
				...prev,
				{
				text: 'Sorry, there was an error processing your message.', 
					sender: 'assistant',
				},
			])
		} finally {
			setIsLoading(false)
		}
	}

	const handleSendMessage = async (userMessage) => {
		const payload = {
			input_value: userMessage,
			output_type: "chat",
			input_type: "chat",
			session_id: "user_1", // You can make this dynamic if needed
		};

		const options = {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		};

		try {
			const response = await fetch('http://localhost:7868/api/v1/run/bfcebcef-08de-4af7-945d-348a04831e6e', options);
			const data = await response.json();
			// Do something with the response, e.g., display it in the chat
			console.log(data);
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
			display: 'flex',
			flexDirection: 'column',
				pointerEvents: 'auto',
				backgroundColor: 'transparent',
			}}
		>
			<div
				className="handle"
				style={{
					cursor: 'move',
					backgroundColor: '#f0f0f0',
					padding: '8px 12px',
					borderTopLeftRadius: 'var(--radius-3)',
					borderTopRightRadius: 'var(--radius-3)',
					borderBottom: '1px solid #e0e0e0',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					pointerEvents: 'auto',
				}}
			>
				<span style={{ fontWeight: 'bold' }}>Chat</span>
			</div>
			<div
				onTouchStartCapture={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
				style={{
				flex: 1,
				backgroundColor: 'var(--color-panel)',
				boxShadow: 'var(--shadow-3)',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				width: '100%',
				border: '2px solid var(--color-background)',
					pointerEvents: 'auto',
					borderBottomLeftRadius: 'var(--radius-3)',
					borderBottomRightRadius: 'var(--radius-3)',
				}}
			>
				{isScreenSharing && (
					<div
						style={{
						padding: '16px',
						backgroundColor: '#ffffff',
							borderBottom: '1px solid #e0e0e0',
						}}
					>
						<div
							style={{
							position: 'relative',
							width: '100%',
							height: '200px',
							backgroundColor: '#000',
							borderRadius: '8px',
								overflow: 'hidden',
							}}
						>
							<video
								ref={videoRef}
								autoPlay
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'contain',
								}}
							/>
							{isAnalyzing && (
								<div
									style={{
									position: 'absolute',
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									backgroundColor: 'rgba(0,0,0,0.5)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
										fontSize: '18px',
									}}
								>
									Analyzing screen...
								</div>
							)}
						</div>
						<div
							style={{
							marginTop: '12px',
							display: 'flex',
							gap: '12px',
								alignItems: 'center',
							}}
						>
							<select
								value={selectedAnalysisType}
								onChange={(e) => setSelectedAnalysisType(e.target.value)}
								style={{
									padding: '8px 12px',
									borderRadius: '6px',
									border: '1px solid #e0e0e0',
									backgroundColor: 'white',
									fontSize: '14px',
									flex: 1,
								}}
							>
								{getPromptDescriptions().map((description) => (
									<option key={description} value={description}>
										{description}
									</option>
								))}
							</select>
							<button
								onClick={captureAndAnalyzeScreen}
								disabled={isAnalyzing}
								style={{
									padding: '8px 16px',
									backgroundColor: isAnalyzing ? '#cccccc' : '#2196F3',
									color: 'white',
									border: 'none',
									borderRadius: '6px',
									cursor: isAnalyzing ? 'not-allowed' : 'pointer',
									fontSize: '14px',
								}}
							>
								{isAnalyzing ? 'Analyzing...' : 'Analyze Screen'}
							</button>
						</div>
					</div>
				)}
				<div
					style={{
					flex: 1, 
					overflowY: 'auto', 
					padding: '20px',
					display: 'flex',
					flexDirection: 'column',
						gap: '12px',
					}}
				>
					{messages.map((msg, index) => (
						<div
							key={index}
							style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
							maxWidth: '80%',
								alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
							}}
						>
							<div
								style={{
								margin: '4px 0',
								padding: '12px 16px',
								backgroundColor: msg.sender === 'user' ? '#2196F3' : '#f5f5f5',
								color: msg.sender === 'user' ? '#ffffff' : '#333333',
								borderRadius: '16px',
								boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
									wordBreak: 'break-word',
								}}
							>
								<MarkdownRenderer content={msg.text} />
							</div>
							<div
								style={{
								fontSize: '12px',
								color: '#666',
									marginTop: '4px',
								}}
							>
								{msg.sender === 'user' ? 'You' : 'Assistant'}
							</div>
						</div>
					))}
					{isLoading && (
						<div
							style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							padding: '12px 16px',
							backgroundColor: '#f5f5f5',
							borderRadius: '16px',
							alignSelf: 'flex-start',
								maxWidth: '80%',
							}}
						>
							<div
								style={{
								width: '12px',
								height: '12px',
								borderRadius: '50%',
								backgroundColor: '#2196F3',
									animation: 'pulse 1s infinite',
								}}
							/>
							<div
								style={{
								width: '12px',
								height: '12px',
								borderRadius: '50%',
								backgroundColor: '#2196F3',
									animation: 'pulse 1s infinite 0.2s',
								}}
							/>
							<div
								style={{
								width: '12px',
								height: '12px',
								borderRadius: '50%',
								backgroundColor: '#2196F3',
									animation: 'pulse 1s infinite 0.4s',
								}}
							/>
						</div>
					)}
				</div>
				<div
					style={{
					display: 'flex', 
					padding: '16px',
					gap: '12px',
					backgroundColor: '#ffffff',
						borderTop: '1px solid #e0e0e0',
					}}
				>
					<button 
						onClick={isScreenSharing ? stopScreenShare : startScreenShare}
						style={{ 
							backgroundColor: isScreenSharing ? '#ff4444' : '#4CAF50',
							color: 'white',
							border: 'none',
							padding: '10px 20px',
							borderRadius: '8px',
							cursor: 'pointer',
							fontWeight: '500',
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							transition: 'background-color 0.2s',
						}}
					>
						{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
					</button>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						style={{ 
							flex: 1,
							padding: '12px 16px',
							borderRadius: '8px',
							border: '1px solid #e0e0e0',
							fontSize: '14px',
							outline: 'none',
							transition: 'border-color 0.2s',
							resize: 'none',
							fontFamily: 'inherit',
						}}
						placeholder="Type your message..."
						rows={3}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault()
								handleSend()
							}
						}}
					/>
					<div
						style={{
							display: 'flex',
							gap: '8px',
						}}
					>
					<button 
						onClick={handleSend}
						disabled={isLoading}
						style={{ 
								backgroundColor: isLoading ? '#cccccc' : '#4CAF50',
							color: 'white',
							border: 'none',
							padding: '10px 20px',
							borderRadius: '8px',
							cursor: isLoading ? 'not-allowed' : 'pointer',
							fontWeight: '500',
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
								transition: 'background-color 0.2s',
						}}
					>
						Send
					</button>
				</div>
			</div>
		</div>
			</div>
	)
}

const BackToChat = () => {
	const editor = useEditor()
	const chatShapeId = createShapeId('chat')

	const isChatShapeVisible = useValue(
		'is chat shape visible',
		() => {
			const shape = editor.getShape(chatShapeId)
			if (!shape) return true // Don't show if it doesn't exist yet

			// getRenderingShapes gives us shapes that are at least partially in the viewport
			const renderingShapes = editor.getRenderingShapes()
			return renderingShapes.some((s) => s.id === chatShapeId)
		},
		[editor, chatShapeId]
	)

	if (isChatShapeVisible) {
		return null
	}

	return (
		<div style={{ position: 'absolute', top: 12, left: 12, zIndex: 9999 }}>
					<button
				onClick={() => {
					const shape = editor.getShape(chatShapeId)
					if (shape) {
						editor.zoomToBounds(editor.getShapePageBounds(shape.id)!)
					}
				}}
				style={{
					backgroundColor: '#1a1a1a',
					color: 'white',
					border: 'none',
					padding: '10px 20px',
					borderRadius: '99px',
					cursor: 'pointer',
					fontWeight: '600',
					boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
					pointerEvents: 'all',
				}}
			>
				Back to Chat
					</button>
				</div>
	)
}

function drawLine(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	width: number
) {
	ctx.beginPath()
	ctx.moveTo(x1, y1)
	ctx.lineTo(x2, y2)
	ctx.lineWidth = width
	ctx.stroke()
}

export function ExamplePage() {
	const { user, isLoaded } = useUser()
	const [store, setStore] = useState<TLStore | null>(null)
	const [chatWidth, setChatWidth] = useState(600)
	const [chatHeight, setChatHeight] = useState(800)
	const [isDragging, setIsDragging] = useState(false)
	const dragStartPos = useRef({ x: 0, y: 0 })
	const dragStartSize = useRef({ width: 0, height: 0 })
	const [isHistoryVisible, setIsHistoryVisible] = useState(false)
	const [logs, setLogs] = useState<ConversationContext[]>([])
	const [summaries, setSummaries] = useState<ConversationSummary[]>([])

	// Initialize store with clean data
	useEffect(() => {
		if (user) {
			// Create a new store
			const newStore = createTLStore()
			
			// Load any existing data
			const storedData = localStorage.getItem(`tldraw-chat-example-${user.id}`)
			if (storedData) {
				try {
					const parsedData = JSON.parse(storedData)
					// Filter out any chat shapes before loading
					if (parsedData.store && parsedData.store.shapes) {
						parsedData.store.shapes = Object.fromEntries(
							Object.entries(parsedData.store.shapes).filter(
								([_, shape]: [string, any]) => shape.type !== 'chat'
							)
						)
					}
					newStore.loadSnapshot(parsedData)
				} catch (error) {
					console.error('Error loading stored data:', error)
				}
			}
			
			setStore(newStore)
		}
	}, [user])

	const handleDragStart = (e: React.MouseEvent) => {
		setIsDragging(true)
		dragStartPos.current = { x: e.clientX, y: e.clientY }
		dragStartSize.current = { width: chatWidth, height: chatHeight }
		document.body.style.cursor = 'nwse-resize'
	}

	const handleDrag = (e: React.MouseEvent) => {
		if (!isDragging) return

		const dx = e.clientX - dragStartPos.current.x
		const dy = e.clientY - dragStartPos.current.y

		setChatWidth(Math.max(300, dragStartSize.current.width + dx))
		setChatHeight(Math.max(400, dragStartSize.current.height + dy))
	}

	const handleDragEnd = () => {
		setIsDragging(false)
		document.body.style.cursor = 'default'
	}

	useEffect(() => {
		if (isDragging) {
			window.addEventListener('mousemove', handleDrag as any)
			window.addEventListener('mouseup', handleDragEnd)
		}
		return () => {
			window.removeEventListener('mousemove', handleDrag as any)
			window.removeEventListener('mouseup', handleDragEnd)
		}
	}, [isDragging])

	if (!isLoaded) {
		return <div>Loading...</div>
	}

	if (!user) {
		return <Navigate to="/login" />
	}

	if (!store) {
		return <div>Initializing...</div>
	}

	return (
		<>
			<div className="tldraw__editor">
				<Tldraw
					store={store}
					overrides={uiOverrides}
					components={components}
					assetUrls={customAssetUrls}
				/>
				<div 
					style={{
						position: 'absolute',
						top: '50%',
						left: '20px',
						transform: 'translateY(-50%)',
						width: `${chatWidth}px`,
						height: `${chatHeight}px`,
						background: 'rgba(255, 255, 255, 0.97)',
						borderRadius: '8px',
						boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
						zIndex: 1000,
						pointerEvents: 'all',
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					<ChatOverlay
						isHistoryVisible={isHistoryVisible}
						setIsHistoryVisible={setIsHistoryVisible}
						logs={logs}
						setLogs={setLogs}
						summaries={summaries}
						setSummaries={setSummaries}
					/>
					<div
						style={{
							position: 'absolute',
							bottom: 0,
							right: 0,
							width: '20px',
							height: '20px',
							cursor: 'nwse-resize',
							background: 'transparent',
						}}
						onMouseDown={handleDragStart}
					/>
				</div>
			</div>

			<HistoryViewer
				isOpen={isHistoryVisible}
				onClose={() => setIsHistoryVisible(false)}
				logs={logs}
				summaries={summaries}
			/>
		</>
	)
}

function HistoryViewer({ isOpen, onClose, logs, summaries }: HistoryViewerProps) {
	const [activeTab, setActiveTab] = useState<'logs' | 'summaries'>('logs')

	if (!isOpen) return null

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}

	return (
		<div 
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0, 0, 0, 0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9999,
				pointerEvents: 'auto',
			}}
			onClick={handleBackdropClick}
		>
			<div 
				style={{
					backgroundColor: 'white',
					padding: '20px',
					borderRadius: '8px',
					height: '100%',
					width: '100%',
					overflow: 'auto',
					position: 'relative',
					zIndex: 10000,
					pointerEvents: 'auto',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '20px',
					position: 'sticky',
					top: 0,
					backgroundColor: 'white',
					padding: '10px 0',
					zIndex: 10001,
						pointerEvents: 'auto',
					}}
				>
					<h2 style={{ margin: 0 }}>Conversation History</h2>
					<button
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onClose()
						}}
						style={{
							padding: '8px 16px',
							backgroundColor: '#ff4444',
							color: 'white',
							border: 'none',
							borderRadius: '4px',
							cursor: 'pointer',
							fontWeight: '500',
							zIndex: 10002,
							pointerEvents: 'auto',
						}}
					>
						Close
					</button>
				</div>
				<div style={{ marginBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
					<button
						onClick={() => setActiveTab('logs')}
						style={{
							padding: '10px 15px',
							border: 'none',
							backgroundColor: activeTab === 'logs' ? '#e0e0e0' : 'transparent',
							cursor: 'pointer',
							fontWeight: activeTab === 'logs' ? 'bold' : 'normal',
							borderTopLeftRadius: '5px',
							borderTopRightRadius: '5px',
							outline: 'none',
						}}
					>
						Logs
					</button>
					<button
						onClick={() => setActiveTab('summaries')}
						style={{
							padding: '10px 15px',
							border: 'none',
							backgroundColor: activeTab === 'summaries' ? '#e0e0e0' : 'transparent',
							cursor: 'pointer',
							fontWeight: activeTab === 'summaries' ? 'bold' : 'normal',
							borderTopLeftRadius: '5px',
							borderTopRightRadius: '5px',
							outline: 'none',
						}}
					>
						Summaries
					</button>
				</div>

				{activeTab === 'logs' && (
					<div
						style={{
						overflowX: 'auto',
							pointerEvents: 'auto',
						}}
					>
						<table
							style={{
							width: '100%',
							borderCollapse: 'collapse',
							marginTop: '10px',
								pointerEvents: 'auto',
							}}
						>
							<thead>
								<tr
									style={{
									backgroundColor: '#f5f5f5',
										pointerEvents: 'auto',
									}}
								>
									<th
										style={{
										padding: '12px',
										textAlign: 'left',
										borderBottom: '2px solid #ddd',
											pointerEvents: 'auto',
										}}
									>
										Timestamp
									</th>
									<th
										style={{
										padding: '12px',
										textAlign: 'left',
										borderBottom: '2px solid #ddd',
											pointerEvents: 'auto',
										}}
									>
										User Message
									</th>
									<th
										style={{
										padding: '12px',
										textAlign: 'left',
										borderBottom: '2px solid #ddd',
											pointerEvents: 'auto',
										}}
									>
										AI Response
									</th>
									<th
										style={{
										padding: '12px',
										textAlign: 'left',
										borderBottom: '2px solid #ddd',
											pointerEvents: 'auto',
										}}
									>
										Screen
									</th>
									<th
										style={{
										padding: '12px',
										textAlign: 'left',
										borderBottom: '2px solid #ddd',
											pointerEvents: 'auto',
										}}
									>
										Screen Analysis
									</th>
								</tr>
							</thead>
							<tbody>
								{logs.map((log, index) => (
									<tr
										key={index}
										style={{
										borderBottom: '1px solid #ddd',
											pointerEvents: 'auto',
										}}
									>
										<td
											style={{
											padding: '12px',
											whiteSpace: 'nowrap',
												pointerEvents: 'auto',
											}}
										>
											{log.timestamp.toLocaleString()}
										</td>
										<td
											style={{
											padding: '12px',
											maxWidth: '300px',
											wordBreak: 'break-word',
												pointerEvents: 'auto',
											}}
										>
											{log.user}
										</td>
										<td
											style={{
											padding: '12px',
											maxWidth: '300px',
											wordBreak: 'break-word',
												pointerEvents: 'auto',
											}}
										>
											{log.ai}
										</td>
										<td
											style={{
											padding: '12px',
												pointerEvents: 'auto',
											}}
										>
											{log.screenDescription ? (
												<img
													src={log.screenDescription}
													alt="Screen capture"
													style={{
														maxWidth: '200px',
														maxHeight: '70%',
														objectFit: 'contain',
														pointerEvents: 'auto',
													}}
												/>
											) : (
												'No screen capture'
											)}
										</td>
										<td
											style={{
											padding: '12px',
											maxWidth: '300px',
											wordBreak: 'break-word',
												pointerEvents: 'auto',
											}}
										>
											{log.screenAnalysis || 'No analysis'}
										</td>								
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{activeTab === 'summaries' && (
					<div
						style={{
						display: 'flex',
						flexDirection: 'column',
							gap: '20px',
						}}
					>
						{summaries.map((summary, index) => (
							<div 
								key={index}
								style={{
									border: '1px solid #ddd',
									borderRadius: '8px',
									padding: '20px',
									backgroundColor: '#f9f9f9',
								}}
							>
								<div
									style={{
									display: 'flex',
									justifyContent: 'space-between',
										marginBottom: '10px',
									}}
								>
									<h3 style={{ margin: 0 }}>Round {summary.roundNumber}</h3>
									<span>{summary.timestamp.toLocaleString()}</span>
								</div>
								<div
									style={{
									whiteSpace: 'pre-wrap',
										marginBottom: '20px',
									}}
								>
									{summary.summary}
								</div>
								<details>
									<summary
										style={{
										cursor: 'pointer',
										color: '#2196F3',
											marginBottom: '10px',
										}}
									>
										View Context
									</summary>
									<div
										style={{
										backgroundColor: '#fff',
										padding: '15px',
										borderRadius: '4px',
											border: '1px solid #eee',
										}}
									>
										{summary.context.userMessages.map((msg, i) => (
											<div key={i} style={{ marginBottom: '15px' }}>
												<div style={{ fontWeight: 'bold', color: '#2196F3' }}>User:</div>
												<div style={{ marginBottom: '5px' }}>{msg}</div>
												<div style={{ fontWeight: 'bold', color: '#4CAF50' }}>AI:</div>
												<div style={{ marginBottom: '5px' }}>
													{summary.context.aiResponses[i]}
												</div>
												<div style={{ fontWeight: 'bold', color: '#FF9800' }}>
													Screen Analysis:
												</div>
												<div style={{ marginBottom: '10px' }}>
													{summary.context.screenAnalyses[i]}
												</div>
											</div>
										))}
									</div>
								</details>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
