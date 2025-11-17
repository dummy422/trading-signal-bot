// TRADING BOT - WITH TP % DISPLAY
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

console.log('🔧 Trading Bot Starting with TP % Display...');

// Top 50 cryptocurrencies
const TOP_COINS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'TRXUSDT',
    'MATICUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'ATOMUSDT',
    'XLMUSDT', 'ETCUSDT', 'XMRUSDT', 'FILUSDT', 'APTUSDT',
    'HBARUSDT', 'NEARUSDT', 'VETUSDT', 'ARBUSDT', 'ICPUSDT',
    'MKRUSDT', 'OPUSDT', 'GRTUSDT', 'ALGOUSDT', 'EOSUSDT',
    'AAVEUSDT', 'STXUSDT', 'QNTUSDT', 'RNDRUSDT', 'XTZUSDT',
    'THETAUSDT', 'EGLDUSDT', 'FTMUSDT', 'AXSUSDT', 'SNXUSDT',
    'SANDUSDT', 'MANAUSDT', 'CRVUSDT', 'GALAUSDT', 'RUNEUSDT',
    'LDOUSDT', 'APEUSDT', 'COMPUSDT', 'DASHUSDT', 'ZECUSDT'
];

class TradingSignalBot {
    constructor() {
        this.minConfidence = 65;
        this.riskRewardRatios = {
            'LONG': { tp: 1.5, sl: 1.0 },  // 1.5% TP, 1.0% SL
            'SHORT': { tp: 1.5, sl: 1.0 }  // 1.5% TP, 1.0% SL
        };
        console.log(`🤖 Trading Bot Started - TP % Display Enabled`);
    }

    async initialize() {
        console.log('🤖 Trading Signal Bot Started!');
        
        if (BOT_TOKEN && CHAT_ID) {
            await this.sendTelegramMessage(
                `🚀 *Trading Signal Bot Started!*\n\n` +
                `📊 *Monitoring:* ${TOP_COINS.length} Top Coins\n` +
                `⏰ *Frequency:* Every 2 minutes\n` +
                `🎯 *TP/SL Ratio:* 1.5% / 1.0%\n` +
                `📈 *Risk/Reward:* 1:1.5`
            );
        }
        
        this.startAnalysis();
    }

    startAnalysis() {
        // Analyze every 2 minutes
        setInterval(() => {
            this.analyzeAllMarkets();
        }, 2 * 60 * 1000);

        // Start immediately
        setTimeout(() => {
            this.analyzeAllMarkets();
        }, 3000);
    }

    async analyzeAllMarkets() {
        console.log(`\n🔍 Analyzing ${TOP_COINS.length} coins - ${new Date().toLocaleString()}`);

        let totalSignals = 0;

        for (const pair of TOP_COINS) {
            try {
                const signal = await this.analyzePair(pair);
                if (signal) {
                    console.log(`✅ SIGNAL: ${pair} ${signal.direction} (${signal.confidence}%) - TP: ${signal.tpPercent}%`);
                    await this.sendSignalToTelegram(signal);
                    totalSignals++;
                }
                
                await this.delay(800);
                
            } catch (error) {
                console.log(`❌ ${pair}:`, error.message);
            }
        }

        console.log(`🎯 Analysis Complete: ${totalSignals} signals found`);
    }

    async analyzePair(pair) {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, {
                timeout: 10000
            });
            
            const data = response.data;

            const price = parseFloat(data.lastPrice);
            const change = parseFloat(data.priceChangePercent);
            const high = parseFloat(data.highPrice);
            const low = parseFloat(data.lowPrice);
            const quoteVolume = parseFloat(data.quoteVolume);

            // Volume filter
            if (quoteVolume < 100000) {
                return null;
            }

            // Calculate volatility
            const volatility = ((high - low) / low * 100);

            // SIGNAL DETECTION
            let direction, confidence;

            // Strong momentum
            if (Math.abs(change) > 4) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 70 + Math.min(25, Math.abs(change));
            }
            // Mean reversion
            else if ((change < -3) || (change > 3)) {
                direction = change < 0 ? 'LONG' : 'SHORT'; // Reverse for mean reversion
                confidence = 65 + Math.min(20, Math.abs(change));
            }
            // Breakout with volume
            else if (Math.abs(change) > 1.5 && quoteVolume > 1000000) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                confidence = 65;
            }
            else {
                return null;
            }

            // Volume boost
            if (quoteVolume > 5000000) confidence += 10;
            if (quoteVolume > 20000000) confidence += 5;

            confidence = Math.max(this.minConfidence, Math.min(95, confidence));

            if (confidence >= this.minConfidence) {
                const ratios = this.riskRewardRatios[direction];
                
                let entry, tp, sl, tpPercent, slPercent;

                if (direction === 'LONG') {
                    // LONG: Buy dip, TP above, SL below
                    entry = (price * 0.995).toFixed(6); // 0.5% below current
                    tp = (parseFloat(entry) * (1 + ratios.tp/100)).toFixed(6);
                    sl = (parseFloat(entry) * (1 - ratios.sl/100)).toFixed(6);
                    tpPercent = ratios.tp;
                    slPercent = ratios.sl;
                } else {
                    // SHORT: Sell bounce, TP below, SL above
                    entry = (price * 1.005).toFixed(6); // 0.5% above current
                    tp = (parseFloat(entry) * (1 - ratios.tp/100)).toFixed(6);
                    sl = (parseFloat(entry) * (1 + ratios.sl/100)).toFixed(6);
                    tpPercent = ratios.tp;
                    slPercent = ratios.sl;
                }

                // Calculate actual percentages from current price
                const currentToTP = Math.abs((parseFloat(tp) - price) / price * 100);
                const currentToSL = Math.abs((parseFloat(sl) - price) / price * 100);

                return {
                    pair: pair.replace('USDT', '/USDT'),
                    direction: direction,
                    entry: this.formatPrice(parseFloat(entry)),
                    tp: this.formatPrice(parseFloat(tp)),
                    sl: this.formatPrice(parseFloat(sl)),
                    currentPrice: this.formatPrice(price),
                    tpPercent: tpPercent,
                    slPercent: slPercent,
                    currentToTP: currentToTP.toFixed(1),
                    currentToSL: currentToSL.toFixed(1),
                    confidence: Math.round(confidence),
                    change: change,
                    volume: this.formatVolume(quoteVolume),
                    volatility: volatility.toFixed(1),
                    riskReward: (tpPercent / slPercent).toFixed(1)
                };
            }

        } catch (error) {
            if (error.response?.status !== 404) {
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
        const directionText = signal.direction === 'LONG' ? 'BUY' : 'SELL';
        
        return `${icon} *${signal.pair} ${directionText}* ${icon}

🎯 *ENTRY:* $${signal.entry}
✅ *TAKE PROFIT:* $${signal.tp} *(+${signal.tpPercent}%)*
❌ *STOP LOSS:* $${signal.sl} *(-${signal.slPercent}%)*
💰 *CURRENT:* $${signal.currentPrice}

📊 *FROM CURRENT PRICE:*
📈 TP: +${signal.currentToTP}%
📉 SL: -${signal.currentToSL}%

⚡ *CONFIDENCE:* ${signal.confidence}%
📈 *24h CHANGE:* ${signal.change.toFixed(2)}%
🌊 *VOLATILITY:* ${signal.volatility}%
💰 *VOLUME:* $${signal.volume}
⚖️ *R/R RATIO:* 1:${signal.riskReward}

💡 *RISK MANAGEMENT:*
- Position Size: 1-2% of capital
- Stop Loss: MANDATORY
- Risk/Reward: 1:${signal.riskReward}
- TP Target: ${signal.tpPercent}% gain

⏰ *TIME:* ${new Date().toLocaleString()}`;
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
        service: 'Trading Bot with TP %',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        config: {
            totalCoins: TOP_COINS.length,
            tpPercent: 1.5,
            slPercent: 1.0,
            riskReward: '1:1.5'
        }
    });
});

// Start the bot
const bot = new TradingSignalBot();

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Monitoring ${TOP_COINS.length} coins with TP % display`);
    console.log(`🎯 TP: 1.5% | SL: 1.0% | R/R: 1:1.5`);
    bot.initialize();
});

module.exports = bot;