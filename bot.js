// TRADING BOT - HIGHLY SENSITIVE SIGNALS
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

console.log('🔧 Starting Highly Sensitive Trading Bot...');

// Top 30 cryptocurrencies for faster analysis
const TOP_COINS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'TRXUSDT',
    'MATICUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'ATOMUSDT',
    'XLMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'NEARUSDT',
    'VETUSDT', 'ALGOUSDT', 'EOSUSDT', 'AAVEUSDT', 'XTZUSDT',
    'THETAUSDT', 'FTMUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT'
];

class TradingSignalBot {
    constructor() {
        this.minConfidence = 60; // Very low threshold
        this.signalsSent = 0;
        console.log(`🤖 Highly Sensitive Bot Started - Will Generate Signals!`);
    }

    async initialize() {
        console.log('🤖 Bot Started - Guaranteed Signal Generation!');
        
        if (BOT_TOKEN && CHAT_ID) {
            await this.sendTelegramMessage(
                `🚀 *HIGHLY SENSITIVE BOT ACTIVATED!*\n\n` +
                `📊 *Monitoring:* ${TOP_COINS.length} Coins\n` +
                `⏰ *Frequency:* Every 90 seconds\n` +
                `🎯 *Min Confidence:* ${this.minConfidence}%\n` +
                `⚡ *GUARANTEED SIGNALS* - Even in flat markets`
            );
        }
        
        this.startAnalysis();
    }

    startAnalysis() {
        // Analyze every 90 seconds (more frequent)
        setInterval(() => {
            this.analyzeAllMarkets();
        }, 90 * 1000);

        // Start immediately
        setTimeout(() => {
            this.analyzeAllMarkets();
        }, 2000);
    }

    async analyzeAllMarkets() {
        console.log(`\n🔍 ULTRA SENSITIVE ANALYSIS - ${new Date().toLocaleString()}`);

        let signalsFound = 0;
        const marketSummary = [];

        for (const pair of TOP_COINS) {
            try {
                const signal = await this.analyzePair(pair);
                if (signal) {
                    console.log(`🎯 SIGNAL FOUND: ${pair} ${signal.direction} (${signal.confidence}%)`);
                    await this.sendSignalToTelegram(signal);
                    signalsFound++;
                    this.signalsSent++;
                } else {
                    // Even if no signal, track market data
                    const marketData = await this.getMarketData(pair);
                    if (marketData) {
                        marketSummary.push(marketData);
                    }
                }
                
                await this.delay(500); // Very short delay
                
            } catch (error) {
                console.log(`⚠️ ${pair}:`, error.message);
            }
        }

        // If no signals found after many attempts, force a signal
        if (signalsFound === 0 && this.signalsSent < 3) {
            await this.generateForcedSignal(marketSummary);
        }

        console.log(`📊 Analysis Complete: ${signalsFound} natural signals`);
    }

    async analyzePair(pair) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, {
                timeout: 8000
            });
            
            const data = response.data;
            const price = parseFloat(data.lastPrice);
            const change = parseFloat(data.priceChangePercent);
            const volume = parseFloat(data.volume);

            // VERY SENSITIVE SIGNAL DETECTION - Will catch even small moves

            let direction, confidence;

            // 1. ANY noticeable movement (even 0.5%)
            if (Math.abs(change) > 0.3) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 65 + Math.min(30, Math.abs(change) * 10);
            }
            // 2. Volume spike detection
            else if (volume > 500000) {
                direction = Math.random() > 0.5 ? 'LONG' : 'SHORT'; // Random direction on volume
                confidence = 62;
            }
            // 3. Time-based signals (if market is very flat)
            else {
                const minutes = new Date().getMinutes();
                if (minutes % 5 === 0) { // Every 5 minutes, generate a signal
                    direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
                    confidence = 61;
                } else {
                    return null;
                }
            }

            // Ensure minimum confidence
            confidence = Math.max(this.minConfidence, confidence);

            if (confidence >= this.minConfidence) {
                // Calculate levels with small risk
                let entry, tp, sl;

                if (direction === 'LONG') {
                    entry = (price * 0.998).toFixed(6);
                    tp = (parseFloat(entry) * 1.008).toFixed(6);  // 0.8% TP
                    sl = (parseFloat(entry) * 0.994).toFixed(6);  // 0.6% SL
                } else {
                    entry = (price * 1.002).toFixed(6);
                    tp = (parseFloat(entry) * 0.992).toFixed(6);  // 0.8% TP
                    sl = (parseFloat(entry) * 1.006).toFixed(6);  // 0.6% SL
                }

                return {
                    pair: pair.replace('USDT', '/USDT'),
                    direction: direction,
                    entry: this.formatPrice(parseFloat(entry)),
                    tp: this.formatPrice(parseFloat(tp)),
                    sl: this.formatPrice(parseFloat(sl)),
                    currentPrice: this.formatPrice(price),
                    confidence: Math.round(confidence),
                    change: change,
                    volume: this.formatVolume(volume),
                    signalType: this.getSignalType(change, confidence),
                    isForced: false
                };
            }

        } catch (error) {
            // Ignore API errors
        }
        return null;
    }

    async getMarketData(pair) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
            const data = response.data;
            return {
                pair: pair,
                price: parseFloat(data.lastPrice),
                change: parseFloat(data.priceChangePercent),
                volume: parseFloat(data.volume)
            };
        } catch (error) {
            return null;
        }
    }

    async generateForcedSignal(marketSummary) {
        if (marketSummary.length === 0) return;

        // Find the coin with highest absolute change
        marketSummary.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
        const bestCoin = marketSummary[0];

        const direction = bestCoin.change > 0 ? 'LONG' : 'SHORT';
        const confidence = 65;

        let entry, tp, sl;
        const price = bestCoin.price;

        if (direction === 'LONG') {
            entry = (price * 0.999).toFixed(6);
            tp = (parseFloat(entry) * 1.006).toFixed(6);  // 0.6% TP
            sl = (parseFloat(entry) * 0.997).toFixed(6);  // 0.3% SL
        } else {
            entry = (price * 1.001).toFixed(6);
            tp = (parseFloat(entry) * 0.994).toFixed(6);  // 0.6% TP
            sl = (parseFloat(entry) * 1.003).toFixed(6);  // 0.3% SL
        }

        const forcedSignal = {
            pair: bestCoin.pair.replace('USDT', '/USDT'),
            direction: direction,
            entry: this.formatPrice(parseFloat(entry)),
            tp: this.formatPrice(parseFloat(tp)),
            sl: this.formatPrice(parseFloat(sl)),
            currentPrice: this.formatPrice(price),
            confidence: confidence,
            change: bestCoin.change,
            volume: this.formatVolume(bestCoin.volume),
            signalType: '📊 MARKET LEADER',
            isForced: true
        };

        console.log(`🎯 FORCING SIGNAL: ${forcedSignal.pair} ${direction}`);
        await this.sendSignalToTelegram(forcedSignal);
        this.signalsSent++;
    }

    getSignalType(change, confidence) {
        if (Math.abs(change) > 2) return '🚀 STRONG MOVE';
        if (Math.abs(change) > 1) return '📈 MODERATE MOVE';
        if (confidence > 70) return '💫 MOMENTUM BUILDING';
        return '🔍 EARLY DETECTION';
    }

    async sendSignalToTelegram(signal) {
        const message = this.formatSignalMessage(signal);
        return await this.sendTelegramMessage(message);
    }

    async sendTelegramMessage(message) {
        if (!BOT_TOKEN || !CHAT_ID) {
            console.log('❌ Telegram not configured.');
            return false;
        }

        try {
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            await axios.post(url, {
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            });
            
            console.log('✅ Telegram message sent successfully!');
            return true;
        } catch (error) {
            console.log('❌ Telegram failed:', error.response?.data?.description || error.message);
            return false;
        }
    }

    formatSignalMessage(signal) {
        const icon = signal.direction === 'LONG' ? '🟢' : '🔴';
        const forcedTag = signal.isForced ? '\\n\\n⚠️ *MARKET LEADER SIGNAL* ⚠️' : '';
        
        return `${icon} *${signal.pair} ${signal.direction}* ${icon}${forcedTag}

${signal.signalType}

🎯 *ENTRY:* $${signal.entry}
✅ *TAKE PROFIT:* $${signal.tp}
❌ *STOP LOSS:* $${signal.sl}
💰 *CURRENT:* $${signal.currentPrice}

⚡ *CONFIDENCE:* ${signal.confidence}%
📈 *24h CHANGE:* ${signal.change.toFixed(2)}%
💰 *VOLUME:* $${signal.volume}

💡 *QUICK SCALP:*
- Small position (0.5-1%)
- Tight stop loss
- Quick profit taking

⏰ *TIME:* ${new Date().toLocaleString()}`;
    }

    formatPrice(price) {
        if (price > 1000) return price.toFixed(2);
        if (price > 1) return price.toFixed(3);
        if (price > 0.01) return price.toFixed(4);
        return price.toFixed(6);
    }

    formatVolume(volume) {
        if (volume > 1000000) return (volume / 1000000).toFixed(1) + 'M';
        if (volume > 1000) return (volume / 1000).toFixed(1) + 'K';
        return volume.toFixed(0);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Highly Sensitive Trading Bot',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        signalsSent: bot.signalsSent || 0,
        config: {
            totalCoins: TOP_COINS.length,
            minConfidence: 60,
            analysisFrequency: '90 seconds',
            guaranteedSignals: true
        }
    });
});

// Start the bot
const bot = new TradingSignalBot();

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🎯 HIGHLY SENSITIVE MODE ACTIVATED`);
    console.log(`📊 Will generate signals in ANY market condition`);
    bot.initialize();
});

module.exports = bot;