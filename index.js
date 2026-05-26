require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const MOTS_COMMANDE = ['commander', 'commande', 'je veux', 'je voudrais', 'acheter'];

// Vérification Webhook Facebook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook vérifié !');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Réception des messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const event = entry.messaging[0];
      const senderId = event.sender.id;
      const message = event.message?.text?.toLowerCase() || '';

      const estUneCommande = MOTS_COMMANDE.some(mot => message.includes(mot));

      if (estUneCommande) {
        await envoyerMessage(senderId,
          `✅ Merci pour votre commande ! Nous avons bien reçu : "${event.message.text}". Nous vous contacterons bientôt.`
        );
        await envoyerSMS(
          `📦 NOUVELLE COMMANDE!\nMessage: "${event.message.text}"`
        );
      } else {
        await envoyerMessage(senderId,
          `Bonjour! 👋 Pour commander écrivez "Je veux commander [produit]". Comment puis-je vous aider?`
        );
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Envoyer message Messenger
async function envoyerMessage(recipientId, texte) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: texte }
      }
    );
  } catch (err) {
    console.error('Erreur Messenger:', err.response?.data || err.message);
  }
}

// Envoyer SMS via Infobip
async function envoyerSMS(texte) {
  try {
    await axios.post(
      `https://${process.env.INFOBIP_BASE_URL}/sms/2/text/advanced`,
      {
        messages: [{
          from: 'BotCommande',
          destinations: [{ to: process.env.MON_NUMERO }],
          text: texte
        }]
      },
      {
        headers: {
          'Authorization': `App ${process.env.INFOBIP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('SMS envoyé !');
  } catch (err) {
    console.error('Erreur SMS:', err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot en ligne sur port ${PORT}`));
