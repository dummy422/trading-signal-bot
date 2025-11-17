// SIMPLE TRADING BOT - WORKING VERSION
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Trading pairs
const TRADING_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'MATICUSDT'];

class TradingSignalBot {
    constructor() {
        this.minConfidence = 75;
    }

    async initialize() {
        console.log('🤖 Trading Signal Bot Started!');
        await this.sendTelegramMessage('🚀 *Trading Signal Bot Started!*\\n\\nMonitoring markets 24/7...');
        this.startAnalysis();
    }

    startAnalysis() {
        // Analyze every 2 minutes
        setInterval(() => {
            this.analyzeAllMarkets();
        }, 2 * 60 * 1000);

        // Run immediately
        this.analyzeAllMarkets();
    }

    async analyzeAllMarkets() {
        console.log('🔍 Analyzing markets...');

        for (const pair of TRADING_PAIRS) {
            try {
                const signal = await this.analyzePair(pair);
                if (signal) {
                    await this.sendSignalToTelegram(signal);
                }
                await this.delay(1000);
            } catch (error) {
                console.log(`Error with ${pair}:`, error.message);
            }
        }
    }

    async analyzePair(pair) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
            const data = response.data;

            const price = parseFloat(data.lastPrice);
            const change = parseFloat(data.priceChangePercent);
            const volume = parseFloat(data.volume);

            // Simple signal logic
            if (Math.abs(change) > 1.5 && volume > 10000) {
                const direction = change > 0 ? 'LONG' : 'SHORT';
                const confidence = 70 + Math.min(25, Math.abs(change));

                let entry, tp, sl;
                if (direction === 'LONG') {
                    entry = (price * 0.998).toFixed(2);
                    sl = (price * 0.99).toFixed(2);
                    tp = (price * 1.012).toFixed(2);
                } else {
                    entry = (price * 1.002).toFixed(2);
                    sl = (price * 1.01).toFixed(2);
                    tp = (price * 0.988).toFixed(2);
                }

                return {
                    pair: pair.replace('USDT', '/USDT'),
                    direction: direction,
                    entry: entry,
                    tp: tp,
                    sl: sl,
                    currentPrice: price.toFixed(2),
                    confidence: Math.round(confidence),
                    change: change
                };
            }
        } catch (error) {
            console.log(`Failed to analyze ${pair}`);
        }
        return null;
    }

    async sendSignalToTelegram(signal) {
        const message = this.formatSignalMessage(signal);
        return await this.sendTelegramMessage(message);
    }

    async sendTelegramMessage(message) {
        if (!BOT_TOKEN || !CHAT_ID) {
            console.log('Telegram not configured');
            return false;
        }

        try {
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const response = await axios.post(url, {
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            });
            console.log('✅ Signal sent to Telegram');
            return true;
        } catch (error) {
            console.log('❌ Failed to send Telegram message');
            return false;
        }
    }

    formatSignalMessage(signal) {
        const icon = signal.direction === 'LONG' ? '🟢' : '🔴';
        
        return `${icon} *${signal.pair} ${signal.direction} SIGNAL* ${icon}

🎯 Entry: $${signal.entry}
✅ TP: $${signal.tp}  
❌ SL: $${signal.sl}
📊 Current: $${signal.currentPrice}

⚡ Confidence: ${signal.confidence}%
📈 24h Change: ${signal.change.toFixed(2)}%

⏰ ${new Date().toLocaleString()}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Trading Signal Bot',
        timestamp: new Date().toISOString()
    });
});

// Start the bot
const bot = new TradingSignalBot();

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    bot.initialize();
});

module.exports = app;