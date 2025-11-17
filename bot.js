// TRADING BOT - TOP 100 COINS ANALYSIS
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

console.log('🔧 Trading Bot Starting with Top 100 Coins Analysis...');

// Top 100 cryptocurrencies by market cap
const TOP_100_COINS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'TRXUSDT',
    'MATICUSDT', 'LINKUSDT', 'WBTCUSDT', 'LTCUSDT', 'BCHUSDT',
    'ATOMUSDT', 'XLMUSDT', 'ETCUSDT', 'XMRUSDT', 'FILUSDT',
    'APTUSDT', 'HBARUSDT', 'NEARUSDT', 'VETUSDT', 'ARBUSDT',
    'ICPUSDT', 'MKRUSDT', 'OPUSDT', 'GRTUSDT', 'ALGOUSDT',
    'EOSUSDT', 'AAVEUSDT', 'STXUSDT', 'QNTUSDT', 'RNDRUSDT',
    'XTZUSDT', 'THETAUSDT', 'EGLDUSDT', 'FTMUSDT', 'AXSUSDT',
    'SNXUSDT', 'KASUSDT', 'SANDUSDT', 'IMXUSDT', 'MANAUSDT',
    'CRVUSDT', 'GALAUSDT', 'RUNEUSDT', 'LDOUSDT', 'APEUSDT',
    'NEOUSDT', 'KAVAUSDT', 'CHZUSDT', 'COMPUSDT', 'DASHUSDT',
    'ZECUSDT', 'ENJUSDT', 'BATUSDT', 'WAVESUSDT', 'HOTUSDT',
    'ZILUSDT', 'IOSTUSDT', 'IOTAUSDT', 'CELRUSDT', 'ONEUSDT',
    'ONTUSDT', 'RVNUSDT', 'SCUSDT', 'ANKRUSDT', 'STORJUSDT',
    'SKLUSDT', 'OCEANUSDT', 'COTIUSDT', 'DGBUSDT', 'RSRUSDT',
    'CTSIUSDT', 'STMXUSDT', 'KNCUSDT', 'LSKUSDT', 'ARDRUSDT',
    'REEFUSDT', 'BANDUSDT', 'DENTUSDT', 'SXPUSDT', 'CVCUSDT',
    'DATAUSDT', 'NKNUSDT', 'ALPHAUSDT', 'PERPUSDT', 'TRBUSDT',
    'LITUSDT', 'KEYUSDT', 'DODOUSDT', 'TLMUSDT', 'BADGERUSDT',
    'PONDUSDT', 'MLNUSDT', 'TWTUSDT', 'IDEXUSDT', 'RLCUSDT'
];

class TradingSignalBot {
    constructor() {
        this.minConfidence = 75;
        this.analysisBatchSize = 10; // Analyze 10 coins at a time to avoid rate limits
        this.currentBatch = 0;
        console.log(`🤖 Trading Bot Started - Monitoring ${TOP_100_COINS.length} Top Coins`);
    }

    async initialize() {
        console.log('🤖 Trading Signal Bot Started!');
        
        if (BOT_TOKEN && CHAT_ID) {
            await this.sendTelegramMessage(
                `🚀 *Trading Signal Bot Started!*\n\n` +
                `📊 *Monitoring:* ${TOP_100_COINS.length} Top Coins\n` +
                `⏰ *Frequency:* Every 3 minutes\n` +
                `🎯 *Min Confidence:* ${this.minConfidence}%`
            );
        } else {
            console.log('⚠️ Telegram not configured.');
        }
        
        this.startAnalysis();
    }

    startAnalysis() {
        // Analyze every 3 minutes (reduced frequency for 100 coins)
        setInterval(() => {
            this.analyzeInBatches();
        }, 3 * 60 * 1000);

        // Start immediately
        setTimeout(() => {
            this.analyzeInBatches();
        }, 5000);
    }

    async analyzeInBatches() {
        const totalBatches = Math.ceil(TOP_100_COINS.length / this.analysisBatchSize);
        this.currentBatch = (this.currentBatch % totalBatches);
        
        const startIdx = this.currentBatch * this.analysisBatchSize;
        const endIdx = Math.min(startIdx + this.analysisBatchSize, TOP_100_COINS.length);
        const currentBatch = TOP_100_COINS.slice(startIdx, endIdx);

        console.log(`\n🔍 Batch ${this.currentBatch + 1}/${totalBatches} - Analyzing ${currentBatch.length} coins...`);

        let signalsFound = 0;
        const batchSignals = [];

        for (const pair of currentBatch) {
            try {
                const signal = await this.analyzePair(pair);
                if (signal) {
                    console.log(`✅ Signal: ${pair} ${signal.direction} (${signal.confidence}%)`);
                    batchSignals.push(signal);
                    signalsFound++;
                }
                await this.delay(1500); // 1.5 second delay between API calls
            } catch (error) {
                console.log(`❌ ${pair}:`, error.message);
            }
        }

        // Send all signals from this batch
        if (batchSignals.length > 0) {
            console.log(`📤 Sending ${batchSignals.length} signals to Telegram...`);
            for (const signal of batchSignals) {
                await this.sendSignalToTelegram(signal);
                await this.delay(1000); // 1 second between Telegram messages
            }
        }

        console.log(`🎯 Batch ${this.currentBatch + 1} complete. Found ${signalsFound} signals.`);
        
        // Move to next batch
        this.currentBatch++;
        
        // If we completed all batches, send summary
        if (this.currentBatch >= totalBatches) {
            this.currentBatch = 0;
            console.log('🔄 Completed full cycle of 100 coins analysis');
        }
    }

    async analyzePair(pair) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, {
                timeout: 10000
            });
            
            const data = response.data;

            const price = parseFloat(data.lastPrice);
            const change = parseFloat(data.priceChangePercent);
            const volume = parseFloat(data.volume);
            const high = parseFloat(data.highPrice);
            const low = parseFloat(data.lowPrice);
            const quoteVolume = parseFloat(data.quoteVolume);

            // Skip coins with very low volume
            if (quoteVolume < 1000000) { // Less than $1M volume
                return null;
            }

            // Calculate metrics
            const volatility = ((high - low) / low * 100);
            const volumeStrength = Math.min(3, quoteVolume / 5000000); // Normalize volume

            // Advanced signal logic
            let direction, confidence, entry, tp, sl;

            // Very strong signals (high volume + high momentum)
            if (Math.abs(change) > 8 && quoteVolume > 50000000 && volatility > 4) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 85 + Math.min(10, Math.abs(change) / 2);
            }
            // Strong signals
            else if (Math.abs(change) > 5 && quoteVolume > 20000000 && volatility > 2.5) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 80 + Math.min(15, Math.abs(change) / 2);
            }
            // Good signals
            else if (Math.abs(change) > 3 && quoteVolume > 10000000 && volatility > 1.5) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 75 + Math.min(20, Math.abs(change) / 2);
            }
            // Moderate signals
            else if (Math.abs(change) > 2 && quoteVolume > 5000000) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 70 + Math.min(25, Math.abs(change));
            }
            else {
                return null;
            }

            // Adjust confidence based on volume strength
            confidence += (volumeStrength * 5);

            // Cap confidence
            confidence = Math.min(95, confidence);

            if (confidence >= this.minConfidence) {
                // Calculate entry levels based on direction and volatility
                const riskMultiplier = volatility * 0.1;
                
                if (direction === 'LONG') {
                    entry = (price * (1 - riskMultiplier * 0.3)).toFixed(4);
                    sl = (price * (1 - riskMultiplier * 1.2)).toFixed(4);
                    tp = (price * (1 + riskMultiplier * 1.8)).toFixed(4);
                } else {
                    entry = (price * (1 + riskMultiplier * 0.3)).toFixed(4);
                    sl = (price * (1 + riskMultiplier * 1.2)).toFixed(4);
                    tp = (price * (1 - riskMultiplier * 1.8)).toFixed(4);
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
                    volume: this.formatVolume(quoteVolume),
                    volatility: volatility.toFixed(2),
                    marketCapRank: TOP_100_COINS.indexOf(pair) + 1
                };
            }

        } catch (error) {
            if (error.response?.status !== 404) { // Ignore "symbol not found" errors
                console.log(`❌ ${pair}:`, error.message);
            }
        }
        return null;
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
            
            console.log('✅ Telegram message sent!');
            return true;
        } catch (error) {
            console.log('❌ Telegram error:', error.response?.data?.description || error.message);
            return false;
        }
    }

    formatSignalMessage(signal) {
        const icon = signal.direction === 'LONG' ? '🟢' : '🔴';
        const trend = signal.change > 0 ? '📈 Bullish' : '📉 Bearish';
        
        return `${icon} *${signal.pair} ${signal.direction}* ${icon}

🏆 *Rank:* #${signal.marketCapRank}
${trend} *(+${Math.abs(signal.change).toFixed(2)}%)*

🎯 *Entry:* $${signal.entry}
✅ *Take Profit:* $${signal.tp}  
❌ *Stop Loss:* $${signal.sl}
📊 *Current:* $${signal.currentPrice}

⚡ *Confidence:* ${signal.confidence}%
📈 *24h Change:* ${signal.change.toFixed(2)}%
🌊 *Volatility:* ${signal.volatility}%
💰 *Volume:* $${signal.volume}

💡 *Risk Management:*
- Position size: 1-2% of capital
- Stop loss mandatory
- Risk/Reward: ~1:1.5

⏰ *Time:* ${new Date().toLocaleString()}`;
    }

    formatPrice(price) {
        if (price > 1000) return price.toFixed(2);
        if (price > 1) return price.toFixed(3);
        if (price > 0.01) return price.toFixed(4);
        return price.toFixed(6);
    }

    formatVolume(volume) {
        if (volume > 1000000000) return (volume / 1000000000).toFixed(2) + 'B';
        if (volume > 1000000) return (volume / 1000000).toFixed(2) + 'M';
        if (volume > 1000) return (volume / 1000).toFixed(2) + 'K';
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
        service: 'Top 100 Coins Trading Bot',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        config: {
            totalCoins: TOP_100_COINS.length,
            hasTelegram: !!(BOT_TOKEN && CHAT_ID),
            minConfidence: 75,
            analysisFrequency: '3 minutes'
        }
    });
});

// Start the bot
const bot = new TradingSignalBot();

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Monitoring ${TOP_100_COINS.length} top cryptocurrencies`);
    console.log(`🌐 Health: https://trading-signal-bot-0xld.onrender.com`);
    bot.initialize();
});

module.exports = app;