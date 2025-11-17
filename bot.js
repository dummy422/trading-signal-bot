
// TRADING BOT v2 - FIXED DEPENDENCIESconst TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const express = require('express');

// Initialize
const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ Missing BOT_TOKEN or CHAT_ID environment variables');
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Trading pairs to monitor
const TRADING_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'MATICUSDT'];

class TradingSignalBot {
    constructor() {
        this.minConfidence = 75;
        console.log('🤖 Trading Signal Bot Started - 24/7 Operation');
    }

    async initialize() {
        // Send startup message
        await this.sendTelegramMessage('🚀 *Trading Signal Bot Started!*\n\nI will monitor markets 24/7 and send high-probability signals automatically.');
        
        // Start continuous analysis
        this.startContinuousAnalysis();
    }

    async startContinuousAnalysis() {
        console.log('🔍 Starting continuous market analysis...');
        
        // Analyze every 2 minutes
        cron.schedule('*/2 * * * *', async () => {
            console.log(`🕒 ${new Date().toLocaleString()} - Analyzing markets...`);
            await this.analyzeAllMarkets();
        });

        // Also run immediately
        await this.analyzeAllMarkets();
    }

    async analyzeAllMarkets() {
        let signalsFound = 0;

        for (const pair of TRADING_PAIRS) {
            try {
                const signal = await this.analyzePair(pair);
                
                if (signal && signal.confidence >= this.minConfidence) {
                    await this.sendSignalToTelegram(signal);
                    signalsFound++;
                }
                
            } catch (error) {
                console.error(`Error analyzing ${pair}:`, error.message);
            }
            
            await this.delay(500); // Rate limiting
        }

        if (signalsFound > 0) {
            console.log(`✅ Sent ${signalsFound} signals to Telegram`);
        }
    }

    async analyzePair(pair) {
        try {
            // Get price data from Binance API
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
            const data = response.data;
            
            const currentPrice = parseFloat(data.lastPrice);
            const priceChange = parseFloat(data.priceChangePercent);
            const high = parseFloat(data.highPrice);
            const low = parseFloat(data.lowPrice);
            const volume = parseFloat(data.volume);

            // Simple signal logic
            let direction, confidence, entry, tp, sl;

            if (priceChange > 2 && volume > 1000) {
                // Bullish signal
                direction = 'LONG';
                confidence = 70 + Math.min(20, priceChange);
                entry = currentPrice * 0.998;
                sl = entry * 0.99;
                tp = entry * 1.015;
            } else if (priceChange < -2 && volume > 1000) {
                // Bearish signal
                direction = 'SHORT';
                confidence = 70 + Math.min(20, Math.abs(priceChange));
                entry = currentPrice * 1.002;
                sl = entry * 1.01;
                tp = entry * 0.985;
            } else {
                return null;
            }

            if (confidence >= this.minConfidence) {
                return {
                    pair: pair.replace('USDT', '/USDT'),
                    direction: direction,
                    entry: this.formatPrice(entry),
                    tp: this.formatPrice(tp),
                    sl: this.formatPrice(sl),
                    currentPrice: this.formatPrice(currentPrice),
                    confidence: Math.round(confidence),
                    change: priceChange,
                    volume: volume
                };
            }

        } catch (error) {
            console.error(`Error fetching data for ${pair}:`, error.message);
        }
        
        return null;
    }

    formatPrice(price) {
        if (price > 1000) return price.toFixed(2);
        if (price > 1) return price.toFixed(3);
        return price.toFixed(4);
    }

    async sendSignalToTelegram(signal) {
        const message = this.formatTelegramMessage(signal);
        return await this.sendTelegramMessage(message);
    }

    async sendTelegramMessage(message) {
        try {
            await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
            console.log('✅ Message sent to Telegram');
            return true;
        } catch (error) {
            console.error('❌ Failed to send Telegram message:', error.message);
            return false;
        }
    }

    formatTelegramMessage(signal) {
        const directionIcon = signal.direction === 'LONG' ? '🟢' : '🔴';
        
        return `
${directionIcon} *${signal.pair} ${signal.direction} SIGNAL* ${directionIcon}

🎯 *Entry:* $${signal.entry}
✅ *Take Profit:* $${signal.tp}
❌ *Stop Loss:* $${signal.sl}
📊 *Current:* $${signal.currentPrice}

⚡ *Confidence:* ${signal.confidence}%
📈 *24h Change:* ${signal.change.toFixed(2)}%
💰 *Volume:* ${this.formatNumber(signal.volume)}

💡 *Risk Management:*
- Risk: 1% of capital
- Stop loss mandatory
- Take profit at 1:1.5 R:R

*Time:* ${new Date().toLocaleString()}
        `.trim();
    }

    formatNumber(num) {
        if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num > 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(0);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        service: 'Trading Signal Bot',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start the bot
const tradingBot = new TradingSignalBot();

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await tradingBot.initialize();
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    await tradingBot.sendTelegramMessage('🔴 *Bot is shutting down for maintenance*');
    process.exit(0);
});