import { useEffect, useRef, useState } from 'react'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages'
import { useUser } from '@clerk/clerk-react'
import MarkdownRenderer from './MarkdownRenderer'

interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
	timestamp: Date
}

interface ConversationContext {
	user: string
	ai: string
	timestamp: Date
	screenDescription?: string
	screenAnalysis?: string
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

function HistoryViewer({ isOpen, onClose, logs, summaries }: HistoryViewerProps) {
	const [activeTab, setActiveTab] = useState<'logs' | 'summaries'>('logs')

	if (!isOpen) return null

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
			onClick={onClose}
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
					<div style={{ overflowX: 'auto' }}>
						<table
							style={{
								width: '100%',
								borderCollapse: 'collapse',
								marginTop: '10px',
							}}
						>
							<thead>
								<tr style={{ backgroundColor: '#f5f5f5' }}>
									<th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
										Timestamp
									</th>
									<th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
										User Message
									</th>
									<th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
										AI Response
									</th>
									<th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
										Screen
									</th>
									<th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
										Screen Analysis
									</th>
								</tr>
							</thead>
							<tbody>
								{logs.map((log, index) => (
									<tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
										<td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
											{new Date(log.timestamp).toLocaleString()}
										</td>
										<td style={{ padding: '12px', maxWidth: '300px', wordBreak: 'break-word' }}>
											{log.user}
										</td>
										<td style={{ padding: '12px', maxWidth: '300px', wordBreak: 'break-word' }}>
											{log.ai}
										</td>
										<td style={{ padding: '12px' }}>
											{log.screenDescription ? (
												<img
													src={log.screenDescription}
													alt="Screen capture"
													style={{
														maxWidth: '200px',
														maxHeight: '150px',
														objectFit: 'contain',
													}}
												/>
											) : (
												'No screen capture'
											)}
										</td>
										<td style={{ padding: '12px', maxWidth: '300px', wordBreak: 'break-word' }}>
											{log.screenAnalysis || 'No analysis'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{activeTab === 'summaries' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
								<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
									<h3 style={{ margin: 0 }}>Round {summary.roundNumber}</h3>
									<span>{new Date(summary.timestamp).toLocaleString()}</span>
								</div>
								<div style={{ whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
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

interface ChatOverlayProps {
	isHistoryVisible: boolean;
	setIsHistoryVisible: React.Dispatch<React.SetStateAction<boolean>>;
	logs: ConversationContext[];
	setLogs: React.Dispatch<React.SetStateAction<ConversationContext[]>>;
	summaries: ConversationSummary[];
	setSummaries: React.Dispatch<React.SetStateAction<ConversationSummary[]>>;
}

export function ChatOverlay({
	isHistoryVisible,
	setIsHistoryVisible,
	logs,
	setLogs,
	summaries,
	setSummaries,
}: ChatOverlayProps) {
	const { user } = useUser()
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [chatModel, setChatModel] = useState<ChatOpenAI | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const [isScreenSharing, setIsScreenSharing] = useState(false)
	const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const videoRef = useRef<HTMLVideoElement>(null)
	const messageHistory = useRef<BaseMessage[]>([])
	const [activeTab, setActiveTab] = useState('logs')
	const [provider, setProvider] = useState<'openai' | 'custom'>('openai')

	// Initialize chat model
	useEffect(() => {
		const initChat = async () => {
			try {
				const apiKey = import.meta.env.VITE_OPENAI_API_KEY
				if (!apiKey) {
					throw new Error('OpenAI API key not configured')
				}

				const model = new ChatOpenAI({
					openAIApiKey: apiKey,
					modelName: 'gpt-4.1',
					maxTokens: 1000,
					temperature: 0.7,
					streaming: true,
				})

				setChatModel(model)
				setError(null)
			} catch (err) {
				console.error('Error initializing chat:', err)
				setError(err instanceof Error ? err.message : 'Failed to initialize chat')
			}
		}

		initChat()
	}, [])

	// Handle video stream
	useEffect(() => {
		if (videoRef.current && screenStream) {
			videoRef.current.srcObject = screenStream
		}
	}, [screenStream])

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

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
			setError('Failed to start screen sharing')
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
		if (!screenStream || !chatModel) return

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

			const response = await chatModel.invoke([
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `Analyze this screen capture and Tldraw state. Provide insights about the diagram and any suggestions for improvement.\n\nTldraw State: ${tldrawJsonData}`,
						},
						{
							type: 'image_url',
							image_url: {
								url: base64Image,
								detail: 'high',
							},
						},
					],
				},
			])

			const analysisText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
			
			// Add to logs
			const newLog: ConversationContext = {
				user: 'Screen Analysis',
				ai: analysisText,
				timestamp: new Date(),
				screenDescription: base64Image,
				screenAnalysis: analysisText,
			}
			setLogs((prev) => [...prev, newLog])

		} catch (error) {
			console.error('Error analyzing screen:', error)
			setError('Failed to analyze screen')
		} finally {
			setIsAnalyzing(false)
		}
	}

	const handleSend = async () => {
		if (!input.trim() || isLoading) return

		const userMessage = input.trim()
		setInput('')
		setIsLoading(true)
		setError(null)

		// Add user message
		const newUserMessage: ChatMessage = {
			role: 'user',
			content: userMessage,
			timestamp: new Date(),
		}
		setMessages((prev) => [...prev, newUserMessage])

		try {
			if (provider === 'custom') {
				// Custom API logic
				const payload = {
					input_value: userMessage,
					output_type: 'chat',
					input_type: 'chat',
					session_id: 'user_1',
				}
				const customApiOptions = {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				}
				const customApiResponse = await fetch('http://localhost:7868/api/v1/run/bfcebcef-08de-4af7-945d-348a04831e6e', customApiOptions)
				const customApiData = await customApiResponse.json()
				// Safely extract the AI message text from the nested response
				let customApiText = ''
				try {
					customApiText = customApiData.outputs?.[0]?.outputs?.[0]?.results?.message?.text ||
						customApiData.outputs?.[0]?.outputs?.[0]?.outputs?.message?.message ||
						customApiData.outputs?.[0]?.outputs?.[0]?.artifacts?.message ||
						customApiData.outputs?.[0]?.outputs?.[0]?.outputs?.message ||
						customApiData.outputs?.[0]?.outputs?.[0]?.message ||
						customApiData.outputs?.[0]?.outputs?.[0]?.text ||
						customApiData.outputs?.[0]?.outputs?.[0] ||
						customApiData.outputs?.[0]?.outputs?.[0]?.results?.message?.text_key ||
						JSON.stringify(customApiData)
				} catch (e) {
					customApiText = JSON.stringify(customApiData)
				}
				const newAssistantMessage: ChatMessage = {
					role: 'assistant',
					content: customApiText,
					timestamp: new Date(),
				}
				setMessages((prev) => [...prev, newAssistantMessage])
				// Optionally, add to logs if needed
				const newLog: ConversationContext = {
					user: userMessage,
					ai: customApiText,
					timestamp: new Date(),
				}
				setLogs((prev) => [...prev, newLog])
				return
			}

			// OpenAI logic (existing)
			if (!chatModel) return
			const humanMessage = new HumanMessage(userMessage)
			messageHistory.current.push(humanMessage)

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
					const analysisResponse = await chatModel.invoke([
						{
							role: 'user',
							content: [
								{
									type: 'text',
									text: `Analyze this screen capture and Tldraw state. Provide insights about the diagram and any suggestions for improvement.\n\nTldraw State: ${tldrawJsonData}`,
								},
								{
									type: 'image_url',
									image_url: {
										url: screenDescription,
										detail: 'high',
									},
								},
							],
						},
					])

					screenAnalysis = typeof analysisResponse.content === 'string' ? analysisResponse.content : JSON.stringify(analysisResponse.content)
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
				const logEntry = logs.find(
					(log) => log.user === msg.content || log.ai === msg.content
				)
			
				return `${timestamp} - ${isHuman ? 'User' : 'Assistant'}: ${msg.content}
${logEntry?.screenAnalysis ? `Screen Analysis: ${logEntry.screenAnalysis}` : ''}`
			})
			.join('\n\n')} 

Current Canvas State: ${screenAnalysis || 'No canvas analysis available'}

User Query: ${userMessage}`

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
								detail: 'high',
							},
						},
					],
				})
			}

			const response = await chatModel.invoke(messages)
			const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)

			// Add assistant message
			const newAssistantMessage: ChatMessage = {
				role: 'assistant',
				content: responseText,
				timestamp: new Date(),
			}
			setMessages((prev) => [...prev, newAssistantMessage])

			const aiMessage = new AIMessage(responseText)
			messageHistory.current.push(aiMessage)

			// Add to logs
			const newLog: ConversationContext = {
				user: userMessage,
				ai: responseText,
				timestamp: new Date(),
				screenDescription,
				screenAnalysis,
			}
			setLogs((prev) => [...prev, newLog])

			// Create summary every 5 messages
			if (logs.length > 0 && logs.length % 5 === 0) {
				const summary: ConversationSummary = {
					roundNumber: Math.floor(logs.length / 5) + 1,
					timestamp: new Date(),
					summary: `Summary of conversation round ${Math.floor(logs.length / 5) + 1}`,
					context: {
						userMessages: logs.slice(-5).map(log => log.user),
						aiResponses: logs.slice(-5).map(log => log.ai),
						screenAnalyses: logs.slice(-5).map(log => log.screenAnalysis || 'No analysis'),
					},
				}
				setSummaries((prev) => [...prev, summary])
			}
		} catch (err) {
			console.error('Error sending message:', err)
			setError(err instanceof Error ? err.message : 'Failed to send message')
		} finally {
			setIsLoading(false)
		}
	}

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	if (error) {
		return (
			<div style={{
				position: 'fixed',
				top: '50%',
				left: '50%',
				transform: 'translate(-50%, -50%)',
				backgroundColor: 'white',
				padding: '20px',
				borderRadius: '8px',
				boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
				zIndex: 1000,
			}}>
				<h3 style={{ color: '#ff4444', margin: '0 0 10px 0' }}>Error</h3>
				<p style={{ margin: 0 }}>{error}</p>
			</div>
		)
	}

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				padding: '20px',
				boxSizing: 'border-box',
				overflowY: 'auto',
				fontSize: '14px',
			}}
		>
			<div
				style={{
					position: 'fixed',
					top: '50%',
					left: 0,
					transform: 'translateY(-50%)',
					width: '100%',
					height: '100%',
					backgroundColor: 'white',
					borderRadius: '8px',
					boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
					display: 'flex',
					flexDirection: 'column',
					zIndex: 1000,
				}}
			>
				<div
					style={{
						padding: '15px',
						borderBottom: '1px solid #e0e0e0',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					}}
				>
					<h3 style={{ margin: 0 }}>Chat</h3>
					<div style={{ display: 'flex', gap: '10px' }}>
						<button
							onClick={() => setIsHistoryVisible(true)}
							style={{
								padding: '8px 12px',
								backgroundColor: '#2196F3',
								color: 'white',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '5px',
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							History
						</button>
						<button
							onClick={isScreenSharing ? stopScreenShare : startScreenShare}
							style={{
								padding: '8px 12px',
								backgroundColor: isScreenSharing ? '#ff4444' : '#4CAF50',
								color: 'white',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '5px',
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
						</button>
					</div>
				</div>

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
					</div>
				)}

				<div
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '15px',
						display: 'flex',
						flexDirection: 'column',
						gap: '10px',
					}}
				>
					{messages.map((message, index) => (
						<div
							key={index}
							style={{
								alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
								maxWidth: '80%',
								backgroundColor: message.role === 'user' ? '#2196F3' : '#f0f0f0',
								color: message.role === 'user' ? 'white' : 'black',
								padding: '10px 15px',
								borderRadius: '15px',
								position: 'relative',
							}}
						>
							<div style={{ marginBottom: '5px' }}>
								<MarkdownRenderer content={message.content} />
							</div>
							<div
								style={{
									fontSize: '0.75rem',
									opacity: 0.7,
									textAlign: 'right',
								}}
							>
								{message.timestamp.toLocaleTimeString()}
							</div>
						</div>
					))}
					{isLoading && (
						<div
							style={{
								alignSelf: 'flex-start',
								backgroundColor: '#f0f0f0',
								padding: '10px 15px',
								borderRadius: '15px',
							}}
						>
							Thinking...
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>

				<div
					style={{
						padding: '15px',
						borderTop: '1px solid #e0e0e0',
						display: 'flex',
						gap: '10px',
					}}
				>
					<div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
						<span>Provider:</span>
						<button
							onClick={() => setProvider('openai')}
							style={{
								padding: '6px 12px',
								backgroundColor: provider === 'openai' ? '#2196F3' : '#e0e0e0',
								color: provider === 'openai' ? 'white' : 'black',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
							}}
						>
							OpenAI
						</button>
						<button
							onClick={() => setProvider('custom')}
							style={{
								padding: '6px 12px',
								backgroundColor: provider === 'custom' ? '#2196F3' : '#e0e0e0',
								color: provider === 'custom' ? 'white' : 'black',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
							}}
						>
							Custom API
						</button>
					</div>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Type your message..."
						style={{
							flex: 1,
							padding: '10px',
							border: '1px solid #e0e0e0',
							borderRadius: '4px',
							resize: 'none',
							minHeight: '60px',
							maxHeight: '120px',
						}}
					/>
					<button
						onClick={handleSend}
						disabled={isLoading || !input.trim()}
						style={{
							padding: '10px 20px',
							backgroundColor: '#2196F3',
							color: 'white',
							border: 'none',
							borderRadius: '4px',
							cursor: 'pointer',
							opacity: isLoading || !input.trim() ? 0.5 : 1,
						}}
					>
						Send
					</button>
				</div>
			</div>
			<HistoryViewer
				isOpen={isHistoryVisible}
				onClose={() => setIsHistoryVisible(false)}
				logs={logs}
				summaries={summaries}
			/>
		</div>
	)
}

export { HistoryViewer }; 