import { getAssetUrlsByMetaUrl } from '@tldraw/assets/urls'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import {
	RouterProvider,
	createBrowserRouter,
	Outlet,
	Link,
	Navigate,
	useLocation,
} from 'react-router-dom'
import { DefaultErrorFallback, ErrorBoundary, setDefaultEditorAssetUrls, setDefaultUiAssetUrls } from 'tldraw'
import { ExamplePage } from './ExamplePage'
import './styles.css'
import {
	ClerkProvider,
	SignIn,
	SignedIn,
	SignedOut,
	UserButton,
	UserProfile,
} from '@clerk/react-router'
import { useAuth, useUser } from '@clerk/clerk-react'
import { AnimatedLoader } from './AnimatedLoader'

// we use secret internal `setDefaultAssetUrls` functions to set these at the
// top-level so assets don't need to be passed down in every single example.
const assetUrls = getAssetUrlsByMetaUrl()
// eslint-disable-next-line local/no-at-internal
setDefaultEditorAssetUrls(assetUrls)
// eslint-disable-next-line local/no-at-internal
setDefaultUiAssetUrls(assetUrls)

// --- CLERK ---
// You can get a publishable key from https://clerk.com/
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
	throw new Error('Missing Clerk publishable key.')
}

function IndexPage() {
	const { isLoaded, isSignedIn } = useAuth()

	if (!isLoaded) {
		return <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>
	}

	if (!isSignedIn) {
		return <Navigate to="/login" />
	}

	return <Navigate to="/canvas" />
}

const router = createBrowserRouter([
	{
		element: <RootLayout />,
		children: [
			{
				path: '/',
				element: <IndexPage />,
			},
			{
				path: '/canvas',
				element: <ExamplePage />,
			},
			{
				path: '/login/*',
				element: <SignInPage />,
			},
			{
				path: '/sign-up/*',
				element: <SignUpPage />,
			},
			{
				path: '/account',
				element: <Navigate to="/account/account" replace />,
			},
			{
				path: '/account/*',
				element: <AccountPage />,
			},
		],
	},
])

function RootLayout() {
	return (
		<ClerkProvider
			publishableKey={PUBLISHABLE_KEY}
			afterSignInUrl="/canvas"
			afterSignUpUrl="/canvas"
		>
			<AppContent />
		</ClerkProvider>
	)
}

function AppContent() {
	const location = useLocation()
	const onCanvas = location.pathname === '/canvas'
	const onAccount = location.pathname.startsWith('/account')
	const onLogin = location.pathname.startsWith('/login')
	const onSignUp = location.pathname.startsWith('/sign-up')

	return (
		<>
			{!onCanvas && !onAccount && !onLogin && !onSignUp && (
				<header
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						padding: '20px',
						borderBottom: '1px solid #ccc',
					}}
				>
					<h1>tldraw</h1>
					<SignedIn>
						<UserButton userProfileUrl="/account" />
					</SignedIn>
					<SignedOut>
						<Link to="/login">Login</Link>
					</SignedOut>
				</header>
			)}
			<main
				style={
					onCanvas || onAccount
						? { width: '100vw', height: '100vh', overflow: 'hidden' }
						: { padding: '20px' }
				}
			>
				<Outlet />
			</main>
		</>
	)
}

function AccountPage() {
	const CreditCardIcon = () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
			<line x1="1" y1="10" x2="23" y2="10"></line>
		</svg>
	)

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
				<Link
					to="/canvas"
					style={{
						marginBottom: '24px',
						padding: '8px 16px',
						background: '#f3f3f3',
						border: '1px solid #ccc',
						borderRadius: '6px',
						textDecoration: 'none',
						color: '#222',
						fontWeight: 500,
						fontSize: '16px',
						boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
					}}
				>
					← Back to Canvas
				</Link>
				<UserProfile path="/account" routing="path">
					<UserProfile.Page label="account" />
					<UserProfile.Page label="Billing" url="billing" labelIcon={<CreditCardIcon />}>
						<BillingPage />
					</UserProfile.Page>
				</UserProfile>
			</div>
		</div>
	)
}

function BillingPage() {
	const { user } = useUser()
	const [error, setError] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!user) return

		const createPortalSession = async () => {
			try {
				const res = await fetch('http://localhost:4242/create-customer-portal-session', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ email: user.primaryEmailAddress?.emailAddress }),
				})

				if (!res.ok) {
					const errorData = await res.json()
					throw new Error(errorData.error || 'Failed to create portal session')
				}

				const { url } = await res.json()
				window.location.href = url
			} catch (e: any) {
				setError(e.message)
			}
		}

		createPortalSession()
	}, [user])

	if (error) {
		return (
			<div>
				<h2>Error</h2>
				<p>{error}</p>
				<p>
					Please make sure you have added your Stripe secret key to the `.env` file and that the
					backend server is running.
				</p>
			</div>
		)
	}

	return (
		<div>
			<h2>Redirecting to Billing Portal...</h2>
		</div>
	)
}

function SignInPage() {
	return (
		<div
			style={{
				width: '100vw',
				height: '100vh',
				position: 'relative',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'hsl(0, 0.00%, 0.00%)',
				color: 'hsl(223,90%,90%)',
				overflow: 'hidden',
			}}
		>
			{/* Animated background */}
			<div
				style={{
					position: 'absolute',
					top: '-30em',
					right: '-50em',
					zIndex: 1,
					filter: 'blur(1px)',
					opacity: 1,
					pointerEvents: 'none',
					width: '120em',
					height: '120em',
					overflow: 'hidden',
				}}
			>
				<AnimatedLoader size="90em" />
			</div>

			{/* Login card */}
			<div
				style={{
					zIndex: 2,
					marginTop: 24,
					background: 'rgba(237, 237, 237, 0.41)',
					borderRadius: 20,
					boxShadow: '0 8px 48px #000a',
					padding: 40,
					backdropFilter: 'blur(8px)',
					border: '1.5px solid rgba(255,255,255,0.08)',
					minWidth: 340,
					maxWidth: '90vw',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
				}}
			>
				<SignIn routing="path" path="/login" signUpUrl="/sign-up" />
			</div>
		</div>
	)
}

function SignUpPage() {
	return (
		<div
			style={{
				width: '100vw',
				height: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<SignIn routing="path" path="/sign-up" afterSignUpUrl="/" />
		</div>
	)
}

const rootElement = document.getElementById('root')!
const root = ReactDOM.createRoot(rootElement)

root.render(
	<React.StrictMode>
		<ErrorBoundary fallback={(error) => <DefaultErrorFallback error={error} />}>
			<HelmetProvider>
				<RouterProvider router={router} />
			</HelmetProvider>
		</ErrorBoundary>
	</React.StrictMode>
)
