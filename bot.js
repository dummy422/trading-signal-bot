// SCALP SPOT CALL BOT - QUICK TRADES
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

console.log('🔥 Scalp Spot Call Bot Starting...');

// High-volume pairs for scalping
const SCALP_PAIRS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT',
    'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'XLMUSDT', 'ETCUSDT',
    'TRXUSDT', 'FILUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT'
];

class ScalpSpotCallBot {
    constructor() {
        this.minConfidence = 70;
        this.scalpSettings = {
            tpPercent: 0.3,    // 0.3% take profit
            slPercent: 0.2,    // 0.2% stop loss
            holdTime: '1-3min', // Quick scalp duration
            riskReward: '1:1.5'
        };
        console.log(`🔥 Scalp Bot Ready - ${SCALP_PAIRS.length} Pairs`);
    }

    async initialize() {
        console.log('🔥 Scalp Spot Call Bot Started!');
        
        if (BOT_TOKEN && CHAT_ID) {
            await this.sendTelegramMessage(
                `🔥 *SCALP SPOT CALL BOT ACTIVATED*\n\n` +
                `🎯 *Strategy:* Quick Scalp Trades\n` +
                `⏰ *Hold Time:* 1-3 minutes\n` +
                `💰 *TP/SL:* ${this.scalpSettings.tpPercent}% / ${this.scalpSettings.slPercent}%\n` +
                `⚡ *Frequency:* Every 60 seconds\n` +
                `📊 *Pairs:* ${SCALP_PAIRS.length} High-Volume`
            );
        }
        
        this.startScalpAnalysis();
    }

    startScalpAnalysis() {
        // Analyze every 60 seconds for scalp opportunities
        setInterval(() => {
            this.analyzeScalpOpportunities();
        }, 60 * 1000);

        // Start immediately
        setTimeout(() => {
            this.analyzeScalpOpportunities();
        }, 3000);
    }

    async analyzeScalpOpportunities() {
        console.log(`\n🔍 Scanning ${SCALP_PAIRS.length} pairs for scalp setups...`);

        let scalpSignals = [];

        for (const pair of SCALP_PAIRS) {
            try {
                const scalpSignal = await this.analyzeScalpPair(pair);
                if (scalpSignal) {
                    console.log(`🎯 SCALP: ${pair} ${scalpSignal.direction} (${scalpSignal.confidence}%)`);
                    scalpSignals.push(scalpSignal);
                }
                
                await this.delay(500); // Fast scanning
                
            } catch (error) {
                console.log(`❌ ${pair}:`, error.message);
            }
        }

        // Sort by confidence and send top 3 scalp signals
        scalpSignals.sort((a, b) => b.confidence - a.confidence);
        const topSignals = scalpSignals.slice(0, 3);

        for (const signal of topSignals) {
            await this.sendScalpCall(signal);
            await this.delay(1000);
        }

        if (topSignals.length > 0) {
            console.log(`🔥 Sent ${topSignals.length} scalp calls`);
        }
    }

    async analyzeScalpPair(pair) {
        try {
            // Get recent price data for scalp analysis
            const [tickerResponse, klinesResponse] = await Promise.all([
                axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`),
                axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=10`)
            ]);

            const tickerData = tickerResponse.data;
            const klines = klinesResponse.data;

            const currentPrice = parseFloat(tickerData.lastPrice);
            const change = parseFloat(tickerData.priceChangePercent);
            const volume = parseFloat(tickerData.volume);
            const high = parseFloat(tickerData.highPrice);
            const low = parseFloat(tickerData.lowPrice);

            // Skip low volume pairs for scalping
            if (volume < 50000) return null;

            // Calculate short-term metrics
            const recentPrices = klines.map(k => parseFloat(k[4])); // closing prices
            const recentHigh = Math.max(...recentPrices);
            const recentLow = Math.min(...recentPrices);
            const currentPosition = ((currentPrice - recentLow) / (recentHigh - recentLow)) * 100;

            // SCALP SIGNAL DETECTION
            let direction, confidence, signalType;

            // 1. MOMENTUM BREAKOUT (Strongest scalp signal)
            if (this.isMomentumBreakout(klines, currentPrice)) {
                direction = currentPrice > recentPrices[recentPrices.length-2] ? 'LONG' : 'SHORT';
                confidence = 85;
                signalType = '🚀 MOMENTUM BREAKOUT';
            }
            // 2. SUPPORT/RESISTANCE BOUNCE
            else if (this.isSupportResistanceBounce(currentPosition, currentPrice, recentHigh, recentLow)) {
                direction = currentPosition < 20 ? 'LONG' : 'SHORT';
                confidence = 80;
                signalType = '📊 S/R BOUNCE';
            }
            // 3. VOLUME SPIKE
            else if (this.isVolumeSpike(klines, volume)) {
                const lastClose = recentPrices[recentPrices.length-2];
                direction = currentPrice > lastClose ? 'LONG' : 'SHORT';
                confidence = 75;
                signalType = '💧 VOLUME SPIKE';
            }
            // 4. TREND PULLBACK
            else if (this.isTrendPullback(recentPrices, currentPosition)) {
                const trend = this.getShortTermTrend(recentPrices);
                direction = trend > 0 ? 'LONG' : 'SHORT';
                confidence = 70;
                signalType = '🔄 TREND PULLBACK';
            }
            else {
                return null;
            }

            // Calculate scalp entries
            let entry, tp, sl;

            if (direction === 'LONG') {
                entry = (currentPrice * 0.9995).toFixed(6); // Slightly below current
                tp = (parseFloat(entry) * (1 + this.scalpSettings.tpPercent/100)).toFixed(6);
                sl = (parseFloat(entry) * (1 - this.scalpSettings.slPercent/100)).toFixed(6);
            } else {
                entry = (currentPrice * 1.0005).toFixed(6); // Slightly above current
                tp = (parseFloat(entry) * (1 - this.scalpSettings.tpPercent/100)).toFixed(6);
                sl = (parseFloat(entry) * (1 + this.scalpSettings.slPercent/100)).toFixed(6);
            }

            return {
                pair: pair.replace('USDT', '/USDT'),
                direction: direction,
                entry: this.formatPrice(parseFloat(entry)),
                tp: this.formatPrice(parseFloat(tp)),
                sl: this.formatPrice(parseFloat(sl)),
                currentPrice: this.formatPrice(currentPrice),
                confidence: confidence,
                signalType: signalType,
                holdTime: this.scalpSettings.holdTime,
                tpPercent: this.scalpSettings.tpPercent,
                slPercent: this.scalpSettings.slPercent,
                riskReward: this.scalpSettings.riskReward,
                volume: this.formatVolume(volume),
                change: change
            };

        } catch (error) {
            console.log(`❌ Scalp analysis failed for ${pair}:`, error.message);
            return null;
        }
    }

    isMomentumBreakout(klines, currentPrice) {
        // Check for strong momentum in recent candles
        const recentCloses = klines.map(k => parseFloat(k[4]));
        const recentOpens = klines.map(k => parseFloat(k[1]));
        
        // Strong bullish momentum
        const bullishMomentum = currentPrice > recentCloses[recentCloses.length-2] * 1.002 && 
                               recentCloses[recentCloses.length-2] > recentCloses[recentCloses.length-3] * 1.001;
        
        // Strong bearish momentum
        const bearishMomentum = currentPrice < recentCloses[recentCloses.length-2] * 0.998 && 
                               recentCloses[recentCloses.length-2] < recentCloses[recentCloses.length-3] * 0.999;

        return bullishMomentum || bearishMomentum;
    }

    isSupportResistanceBounce(position, currentPrice, high, low) {
        // Price at key support/resistance levels
        const atSupport = position < 15 && currentPrice > low * 1.001;
        const atResistance = position > 85 && currentPrice < high * 0.999;
        
        return atSupport || atResistance;
    }

    isVolumeSpike(klines, currentVolume) {
        // Check if current volume is significantly higher than recent average
        const recentVolumes = klines.map(k => parseFloat(k[5]));
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        
        return currentVolume > avgVolume * 2; // 2x volume spike
    }

    isTrendPullback(prices, position) {
        const trend = this.getShortTermTrend(prices);
        
        // Pullback in uptrend
        if (trend > 0 && position < 40) return true;
        // Pullback in downtrend
        if (trend < 0 && position > 60) return true;
        
        return false;
    }

    getShortTermTrend(prices) {
        const recentAvg = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const earlierAvg = prices.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        
        return recentAvg > earlierAvg ? 1 : -1;
    }

    async sendScalpCall(signal) {
        const message = this.formatScalpCall(signal);
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
            
            console.log('✅ Scalp call sent!');
            return true;
        } catch (error) {
            console.log('❌ Telegram error:', error.response?.data?.description || error.message);
            return false;
        }
    }

    formatScalpCall(signal) {
        const icon = signal.direction === 'LONG' ? '🟢' : '🔴';
        const action = signal.direction === 'LONG' ? 'BUY' : 'SELL';
        
        return `🔥 *SCALP SPOT CALL* 🔥

${icon} *${signal.pair} ${action}* ${icon}
${signal.signalType}

🎯 *ENTRY:* $${signal.entry}
✅ *TP:* $${signal.tp} *(+${signal.tpPercent}%)*
❌ *SL:* $${signal.sl} *(-${signal.slPercent}%)*
💰 *CURRENT:* $${signal.currentPrice}

⚡ *HOLD TIME:* ${signal.holdTime}
🎯 *CONFIDENCE:* ${signal.confidence}%
⚖️ *R/R:* ${signal.riskReward}

📊 *STATS:*
📈 24h Change: ${signal.change.toFixed(2)}%
💧 Volume: $${signal.volume}

💡 *SCALP STRATEGY:*
• Quick entry/exit
• Tight stops
• Take profit quickly
• Don't greed

⏰ *TIME:* ${new Date().toLocaleTimeString()}
🕒 *DURATION:* ${signal.holdTime}`;
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
        service: 'Scalp Spot Call Bot',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        config: {
            pairs: SCALP_PAIRS.length,
            scanFrequency: '60 seconds',
            tpPercent: 0.3,
            slPercent: 0.2,
            holdTime: '1-3 minutes'
        }
    });
});

// Start the bot
const bot = new ScalpSpotCallBot();

app.listen(PORT, () => {
    console.log(`🔥 Scalp Bot running on port ${PORT}`);
    console.log(`⏰ Scanning every 60 seconds`);
    console.log(`🎯 TP: 0.3% | SL: 0.2% | Hold: 1-3min`);
    bot.initialize();
});

module.exports = bot;