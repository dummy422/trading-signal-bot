const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
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
const binance = new ccxt.binance();

// Trading pairs to monitor
const TRADING_PAIRS = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'MATIC/USDT',
    'BNB/USDT', 'ADA/USDT', 'XRP/USDT', 'DOT/USDT', 'LINK/USDT'
];

// Store last signals to avoid duplicates
const lastSignals = new Map();

class TradingSignalBot {
    constructor() {
        this.ohlcData = new Map();
        this.minConfidence = 75;
        console.log('🤖 Trading Signal Bot Started - 24/7 Operation');
    }

    async initialize() {
        // Load initial historical data
        await this.loadHistoricalData();
        
        // Start continuous analysis
        this.startContinuousAnalysis();
        
        // Send startup message
        await this.sendTelegramMessage('🚀 *Trading Signal Bot Started!*\n\nI will monitor markets 24/7 and send high-probability signals automatically.');
    }

    async loadHistoricalData() {
        console.log('📊 Loading historical data...');
        
        for (const pair of TRADING_PAIRS) {
            try {
                const symbol = pair.replace('/', '');
                const ohlcv = await binance.fetchOHLCV(symbol, '5m', undefined, 100);
                
                this.ohlcData.set(pair, ohlcv.map(candle => ({
                    timestamp: candle[0],
                    open: candle[1],
                    high: candle[2],
                    low: candle[3],
                    close: candle[4],
                    volume: candle[5]
                })));
                
                console.log(`✅ Loaded data for ${pair}`);
            } catch (error) {
                console.error(`❌ Failed to load data for ${pair}:`, error.message);
            }
            
            // Rate limiting
            await this.delay(200);
        }
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
                    // Check for duplicates
                    const signalKey = `${pair}-${signal.direction}-${Math.round(signal.entry)}`;
                    const lastSignalTime = lastSignals.get(signalKey);
                    
                    if (!lastSignalTime || (Date.now() - lastSignalTime) > 30 * 60 * 1000) { // 30 min cooldown
                        await this.sendSignalToTelegram(signal);
                        lastSignals.set(signalKey, Date.now());
                        signalsFound++;
                    }
                }
                
                // Update OHLC data
                await this.updateOHLCData(pair);
                
            } catch (error) {
                console.error(`Error analyzing ${pair}:`, error.message);
            }
            
            await this.delay(100); // Rate limiting
        }

        if (signalsFound > 0) {
            console.log(`✅ Sent ${signalsFound} signals to Telegram`);
        }
    }

    async analyzePair(pair) {
        const ohlc = this.ohlcData.get(pair);
        if (!ohlc || ohlc.length < 50) return null;

        const closes = ohlc.map(c => c.close);
        const highs = ohlc.map(c => c.high);
        const lows = ohlc.map(c => c.low);
        const volumes = ohlc.map(c => c.volume);

        const indicators = this.calculateAllIndicators(closes, highs, lows, volumes);
        const signal = this.generateAdvancedSignal(indicators, ohlc[ohlc.length - 1].close);
        
        if (signal) {
            return {
                pair: pair,
                direction: signal.direction,
                entry: this.formatPrice(signal.entry),
                tp: this.formatPrice(signal.tp),
                sl: this.formatPrice(signal.sl),
                currentPrice: this.formatPrice(ohlc[ohlc.length - 1].close),
                indicators: indicators,
                confidence: signal.confidence
            };
        }
        
        return null;
    }

    calculateAllIndicators(closes, highs, lows, volumes) {
        // RSI
        const rsi = this.calculateRSI(closes, 14);
        
        // MACD
        const macd = this.calculateMACD(closes);
        
        // Bollinger Bands
        const bb = this.calculateBollingerBands(closes, 20, 2);
        
        // Moving Averages
        const ema20 = this.calculateEMA(closes, 20);
        const ema50 = this.calculateEMA(closes, 50);
        
        // Volume analysis
        const volumeAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = volumes[volumes.length - 1];
        const volumeRatio = currentVolume / volumeAvg;

        return {
            rsi: rsi[rsi.length - 1],
            macd: macd[macd.length - 1],
            bb: bb[bb.length - 1],
            ema20: ema20[ema20.length - 1],
            ema50: ema50[ema50.length - 1],
            volumeRatio: volumeRatio,
            trend: ema20[ema20.length - 1] > ema50[ema50.length - 1] ? 'bullish' : 'bearish'
        };
    }

    calculateRSI(closes, period) {
        const rsi = [];
        for (let i = period; i < closes.length; i++) {
            const slice = closes.slice(i - period, i);
            let gains = 0;
            let losses = 0;
            
            for (let j = 1; j < slice.length; j++) {
                const diff = slice[j] - slice[j - 1];
                if (diff > 0) gains += diff;
                else losses -= diff;
            }
            
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
        return rsi;
    }

    calculateMACD(closes) {
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macdLine = [];
        
        for (let i = 0; i < ema26.length; i++) {
            if (ema12[i + 14] !== undefined) {
                macdLine.push(ema12[i + 14] - ema26[i]);
            }
        }
        return macdLine;
    }

    calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = [data[0]];
        for (let i = 1; i < data.length; i++) {
            ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }
        return ema;
    }

    calculateBollingerBands(closes, period, stdDev) {
        const bands = [];
        for (let i = period - 1; i < closes.length; i++) {
            const slice = closes.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / period;
            const standardDeviation = Math.sqrt(variance);
            
            bands.push({
                upper: mean + (standardDeviation * stdDev),
                middle: mean,
                lower: mean - (standardDeviation * stdDev)
            });
        }
        return bands;
    }

    generateAdvancedSignal(indicators, currentPrice) {
        let confidence = 0;
        
        // RSI Conditions
        const rsiOversold = indicators.rsi < 30;
        const rsiOverbought = indicators.rsi > 70;
        
        // MACD Conditions
        const macdBullish = indicators.macd > 0;
        const macdBearish = indicators.macd < 0;
        
        // Bollinger Bands Conditions
        const bbPosition = (currentPrice - indicators.bb.lower) / (indicators.bb.upper - indicators.bb.lower);
        const bbOversold = bbPosition < 0.2;
        const bbOverbought = bbPosition > 0.8;
        
        // Moving Average Conditions
        const trendBullish = indicators.trend === 'bullish';
        const trendBearish = indicators.trend === 'bearish';
        const aboveEMA20 = currentPrice > indicators.ema20;
        const belowEMA20 = currentPrice < indicators.ema20;
        
        // Volume Conditions
        const highVolume = indicators.volumeRatio > 1.5;
        
        // Generate LONG signal with confluence
        if (trendBullish && aboveEMA20 && 
            (rsiOversold || bbOversold) && 
            macdBullish && highVolume) {
            
            confidence = 75;
            if (bbOversold) confidence += 10;
            
            const entry = currentPrice * 0.998;
            const sl = Math.min(entry * 0.99, indicators.bb.lower);
            const tp = entry * 1.015;
            
            return {
                direction: 'LONG',
                entry: entry,
                tp: tp,
                sl: sl,
                confidence: Math.min(95, confidence)
            };
        }
        
        // Generate SHORT signal with confluence
        if (trendBearish && belowEMA20 && 
            (rsiOverbought || bbOverbought) && 
            macdBearish && highVolume) {
            
            confidence = 75;
            if (bbOverbought) confidence += 10;
            
            const entry = currentPrice * 1.002;
            const sl = Math.max(entry * 1.01, indicators.bb.upper);
            const tp = entry * 0.985;
            
            return {
                direction: 'SHORT',
                entry: entry,
                tp: tp,
                sl: sl,
                confidence: Math.min(95, confidence)
            };
        }
        
        return null;
    }

    formatPrice(price) {
        if (price > 1000) return price.toFixed(2);
        if (price > 1) return price.toFixed(3);
        return price.toFixed(4);
    }

    async updateOHLCData(pair) {
        try {
            const symbol = pair.replace('/', '');
            const ohlcv = await binance.fetchOHLCV(symbol, '5m', undefined, 1);
            
            if (ohlcv.length > 0) {
                const currentData = this.ohlcData.get(pair) || [];
                const newCandle = {
                    timestamp: ohlcv[0][0],
                    open: ohlcv[0][1],
                    high: ohlcv[0][2],
                    low: ohlcv[0][3],
                    close: ohlcv[0][4],
                    volume: ohlcv[0][5]
                };

                // Update or add candle
                if (currentData.length > 0 && 
                    currentData[currentData.length - 1].timestamp === newCandle.timestamp) {
                    // Update last candle
                    currentData[currentData.length - 1] = newCandle;
                } else {
                    // Add new candle
                    currentData.push(newCandle);
                    if (currentData.length > 100) {
                        currentData.shift();
                    }
                }

                this.ohlcData.set(pair, currentData);
            }
        } catch (error) {
            console.error(`Error updating OHLC data for ${pair}:`, error.message);
        }
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
        const riskReward = '1:1.5';
        
        return `
${directionIcon} *${signal.pair} ${signal.direction} SIGNAL* ${directionIcon}

🎯 *Entry:* $${signal.entry}
✅ *Take Profit:* $${signal.tp}
❌ *Stop Loss:* $${signal.sl}
📊 *Current:* $${signal.currentPrice}

⚡ *Confidence:* ${signal.confidence}%
📈 *Risk/Reward:* ${riskReward}

*Technical Setup:*
• RSI: ${signal.indicators.rsi.toFixed(1)}
• MACD: ${signal.indicators.macd.toFixed(4)}
• Trend: ${signal.indicators.trend}
• Volume: ${signal.indicators.volumeRatio.toFixed(1)}x

💡 *Risk Management:*
- Risk: 1% of capital
- Stop loss mandatory
- Take profit at 1:1.5 R:R

*Time:* ${new Date().toLocaleString()}
        `.trim();
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