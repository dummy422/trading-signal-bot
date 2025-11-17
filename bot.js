// TRADING BOT - ADAPTIVE MARKET ANALYSIS
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

console.log('🔧 Trading Bot Starting with Adaptive Market Analysis...');

// Top 50 cryptocurrencies (more manageable)
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
        this.minConfidence = 65; // Lowered for more signals
        this.marketConditions = 'analyzing';
        this.lastAnalysisTime = null;
        console.log(`🤖 Trading Bot Started - Monitoring ${TOP_COINS.length} Coins`);
    }

    async initialize() {
        console.log('🤖 Trading Signal Bot Started!');
        
        if (BOT_TOKEN && CHAT_ID) {
            await this.sendTelegramMessage(
                `🚀 *Trading Signal Bot Started!*\n\n` +
                `📊 *Monitoring:* ${TOP_COINS.length} Top Coins\n` +
                `⏰ *Frequency:* Every 2 minutes\n` +
                `🎯 *Min Confidence:* ${this.minConfidence}%\n` +
                `🔍 *Market Mode:* Adaptive Analysis`
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
        this.lastAnalysisTime = new Date();

        let totalSignals = 0;
        let marketSentiment = 0;
        let coinsAnalyzed = 0;

        for (const pair of TOP_COINS) {
            try {
                const signal = await this.analyzePair(pair);
                if (signal) {
                    console.log(`✅ SIGNAL: ${pair} ${signal.direction} (${signal.confidence}%)`);
                    await this.sendSignalToTelegram(signal);
                    totalSignals++;
                    
                    // Track market sentiment
                    marketSentiment += signal.direction === 'LONG' ? 1 : -1;
                }
                coinsAnalyzed++;
                
                // Small delay to avoid rate limits
                await this.delay(800);
                
            } catch (error) {
                console.log(`❌ ${pair}:`, error.message);
            }
        }

        // Determine market conditions
        this.updateMarketConditions(marketSentiment, coinsAnalyzed);
        
        console.log(`🎯 Analysis Complete: ${totalSignals} signals found`);
        console.log(`📈 Market Sentiment: ${this.marketConditions}`);
        
        // Send market summary if no signals but market is active
        if (totalSignals === 0 && coinsAnalyzed > 0) {
            await this.sendMarketSummary(marketSentiment, coinsAnalyzed);
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

            // More inclusive volume filter
            if (quoteVolume < 100000) { // Only $100k minimum volume
                return null;
            }

            // Calculate metrics
            const volatility = ((high - low) / low * 100);
            const pricePosition = ((price - low) / (high - low)) * 100; // 0-100% range

            // ADAPTIVE SIGNAL LOGIC - Works in all market conditions
            
            let direction, confidence, entry, tp, sl;
            let signalStrength = 0;

            // 1. MOMENTUM SIGNALS (Strong directional moves)
            if (Math.abs(change) > 4) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                signalStrength += Math.min(30, Math.abs(change) * 3);
            }
            // 2. MEAN REVERSION (Oversold/Overbought)
            else if ((change < -3 && pricePosition < 30) || (change > 3 && pricePosition > 70)) {
                direction = change < -3 ? 'LONG' : 'SHORT'; // Reverse for mean reversion
                signalStrength += 25;
            }
            // 3. BREAKOUT (High volume + moderate move)
            else if (Math.abs(change) > 1.5 && quoteVolume > 1000000) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                signalStrength += 20;
            }
            // 4. VOLATILITY PLAY (High volatility + any direction)
            else if (volatility > 3 && Math.abs(change) > 1) {
                direction = change > 0 ? 'LONG' : 'SHORT';
                signalStrength += 15;
            }
            else {
                return null;
            }

            // Base confidence
            confidence = 60 + signalStrength;

            // Volume boost
            if (quoteVolume > 5000000) confidence += 10;
            if (quoteVolume > 20000000) confidence += 5;

            // Volatility adjustment
            confidence += Math.min(10, volatility);

            // Ensure minimum confidence
            confidence = Math.max(this.minConfidence, Math.min(95, confidence));

            if (confidence >= this.minConfidence) {
                // Dynamic position sizing based on volatility
                const riskFactor = Math.max(0.5, Math.min(2, volatility / 2));
                
                if (direction === 'LONG') {
                    entry = (price * (1 - 0.002 * riskFactor)).toFixed(6);
                    sl = (price * (1 - 0.008 * riskFactor)).toFixed(6);
                    tp = (price * (1 + 0.012 * riskFactor)).toFixed(6);
                } else {
                    entry = (price * (1 + 0.002 * riskFactor)).toFixed(6);
                    sl = (price * (1 + 0.008 * riskFactor)).toFixed(6);
                    tp = (price * (1 - 0.012 * riskFactor)).toFixed(6);
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
                    signalType: this.getSignalType(change, volatility, pricePosition),
                    marketCondition: this.marketConditions
                };
            }

        } catch (error) {
            // Ignore "symbol not found" errors, log others
            if (error.response?.status !== 404) {
                console.log(`❌ ${pair}:`, error.message);
            }
        }
        return null;
    }

    updateMarketConditions(sentiment, totalCoins) {
        if (totalCoins === 0) return;
        
        const sentimentScore = sentiment / totalCoins;
        
        if (sentimentScore > 0.3) {
            this.marketConditions = '🟢 STRONG BULLISH';
        } else if (sentimentScore > 0.1) {
            this.marketConditions = '🟡 MILD BULLISH';
        } else if (sentimentScore < -0.3) {
            this.marketConditions = '🔴 STRONG BEARISH';
        } else if (sentimentScore < -0.1) {
            this.marketConditions = '🟠 MILD BEARISH';
        } else {
            this.marketConditions = '⚪ NEUTRAL/SIDEWAYS';
        }
    }

    getSignalType(change, volatility, pricePosition) {
        if (Math.abs(change) > 5) return '🚀 STRONG MOMENTUM';
        if (volatility > 4) return '🌊 HIGH VOLATILITY';
        if (pricePosition < 20 || pricePosition > 80) return '🔄 MEAN REVERSION';
        return '📈 TREND FOLLOWING';
    }

    async sendMarketSummary(sentiment, totalCoins) {
        if (!BOT_TOKEN || !CHAT_ID) return;
        
        const sentimentScore = sentiment / totalCoins;
        const summaryMessage = `
📊 *Market Summary Report*

🔍 *Coins Analyzed:* ${totalCoins}
📈 *Market Sentiment:* ${this.marketConditions}
⚖️ *Sentiment Score:* ${sentimentScore.toFixed(2)}

💡 *Current Conditions:*
- No high-confidence signals detected
- Market is ${this.getMarketState(sentimentScore)}
- Lower volatility or consolidation phase

🎯 *Recommendation:*
${this.getTradingRecommendation(sentimentScore)}

⏰ *Next Analysis:* 2 minutes
${this.lastAnalysisTime ? `*Last Scan:* ${this.lastAnalysisTime.toLocaleTimeString()}` : ''}
        `.trim();

        // Only send summary every 30 minutes to avoid spam
        const now = new Date();
        if (!this.lastSummaryTime || (now - this.lastSummaryTime) > 30 * 60 * 1000) {
            await this.sendTelegramMessage(summaryMessage);
            this.lastSummaryTime = now;
        }
    }

    getMarketState(sentimentScore) {
        if (Math.abs(sentimentScore) > 0.3) return 'trending strongly';
        if (Math.abs(sentimentScore) > 0.1) return 'showing mild direction';
        return 'consolidating or ranging';
    }

    getTradingRecommendation(sentimentScore) {
        if (sentimentScore > 0.2) return 'Look for LONG opportunities on pullbacks';
        if (sentimentScore < -0.2) return 'Look for SHORT opportunities on bounces';
        return 'Wait for clearer direction or trade ranges';
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
        
        return `${icon} *${signal.pair} ${signal.direction}* ${icon}

${signal.signalType}
📊 *Market:* ${signal.marketCondition}

🎯 *Entry:* $${signal.entry}
✅ *Take Profit:* $${signal.tp}  
❌ *Stop Loss:* $${signal.sl}
💰 *Current:* $${signal.currentPrice}

⚡ *Confidence:* ${signal.confidence}%
📈 *24h Change:* ${signal.change.toFixed(2)}%
🌊 *Volatility:* ${signal.volatility}%
💧 *Volume:* $${signal.volume}

💡 *Risk Management:*
- Position: 1-2% of capital
- Stop loss: Mandatory
- R/R Ratio: ~1:1.5

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
    const bot = require('./bot.js');
    res.json({
        status: 'online',
        service: 'Adaptive Trading Bot',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        config: {
            totalCoins: TOP_COINS.length,
            minConfidence: 65,
            analysisFrequency: '2 minutes',
            marketConditions: bot.marketConditions || 'analyzing'
        }
    });
});

// Start the bot
const bot = new TradingSignalBot();

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Monitoring ${TOP_COINS.length} cryptocurrencies`);
    console.log(`🌐 Health: https://trading-signal-bot-0xld.onrender.com`);
    bot.initialize();
});

module.exports = bot;