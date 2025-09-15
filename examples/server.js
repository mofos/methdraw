require('dotenv').config({ path: './apps/examples/src/.env' })
const express = require('express')
const cors = require('cors')
const stripe = require('stripe')(process.env.VITE_STRIPE_SECRET_KEY)

const app = express()
app.use(cors())
app.use(express.json())

app.post('/create-customer-portal-session', async (req, res) => {
	const { email } = req.body

	if (!email) {
		return res.status(400).send({ error: 'Email is required' })
	}

	try {
		// Find existing customer or create a new one
		let customers = await stripe.customers.list({ email: email })
		let customer

		if (customers.data.length > 0) {
			customer = customers.data[0]
		} else {
			customer = await stripe.customers.create({ email: email })
		}

		// Create a billing portal session
		const billingPortalSession = await stripe.billingPortal.sessions.create({
			customer: customer.id,
			return_url: `${req.headers.origin}/account/billing`,
		})

		res.json({ url: billingPortalSession.url })
	} catch (error) {
		console.error('Stripe error:', error)
		res.status(500).send({ error: error.message })
	}
})

const PORT = process.env.PORT || 4242
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`)) 