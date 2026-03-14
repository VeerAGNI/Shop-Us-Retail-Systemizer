import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Mic, MicOff, Send, Sparkles, Search, TrendingUp, Lightbulb, Loader2, Copy, Check } from 'lucide-react';
import { Transaction, ShopMemory } from '../store';
import Markdown from 'react-markdown';
import { useLanguage } from '../LanguageContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface AIAssistantProps {
  transactions: Transaction[];
  memory: ShopMemory | null;
  updateMemory: (updates: Partial<ShopMemory>) => Promise<void>;
  addTransaction: (t: Omit<Transaction, 'id' | 'timestamp' | 'userId'>) => Promise<void>;
}

export function AIAssistant({ transactions, memory, updateMemory, addTransaction }: AIAssistantProps) {
  const { t } = useLanguage();
  const [activeMode, setActiveMode] = useState<'investigator' | 'voice' | 'analysis' | 'strategy'>('investigator');
  
  // Lifted state to persist across tab switches
  const [investigatorMessages, setInvestigatorMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: t('investigatorGreeting') }
  ]);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [strategyText, setStrategyText] = useState<string>('');
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
        <button 
          onClick={() => setActiveMode('investigator')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeMode === 'investigator' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
        >
          <Search size={16} /> {t('investigator')}
        </button>
        <button 
          onClick={() => setActiveMode('voice')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeMode === 'voice' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
        >
          <Mic size={16} /> {t('voiceTracking')}
        </button>
        <button 
          onClick={() => setActiveMode('analysis')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeMode === 'analysis' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
        >
          <TrendingUp size={16} /> {t('analysis')}
        </button>
        <button 
          onClick={() => setActiveMode('strategy')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeMode === 'strategy' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
        >
          <Lightbulb size={16} /> {t('strategy')}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeMode === 'investigator' && <InvestigatorMode memory={memory} updateMemory={updateMemory} messages={investigatorMessages} setMessages={setInvestigatorMessages} />}
        {activeMode === 'voice' && <VoiceTrackingMode addTransaction={addTransaction} />}
        {activeMode === 'analysis' && <AnalysisMode transactions={transactions} memory={memory} updateMemory={updateMemory} analysis={analysisText} setAnalysis={setAnalysisText} />}
        {activeMode === 'strategy' && <StrategyMode transactions={transactions} memory={memory} strategy={strategyText} setStrategy={setStrategyText} />}
      </div>
    </div>
  );
}

function InvestigatorMode({ memory, updateMemory, messages, setMessages }: { memory: ShopMemory | null, updateMemory: (u: Partial<ShopMemory>) => Promise<void>, messages: {role: 'user' | 'model', text: string}[], setMessages: React.Dispatch<React.SetStateAction<{role: 'user' | 'model', text: string}[]>> }) {
  const { t, language } = useLanguage();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert(t('micAccessDenied'));
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, t]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const chat = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: `You are an investigator for a shop owner. Your goal is to socratically ask ONE short question at a time to uncover missing details about their shop, their personal experience, what makes their shop special, why people come there, peak hours, income, etc.
          If the user doesn't know the answer or can't answer, gracefully move on and change the question to something else. Keep it easy and conversational.
          Current Memory Facts: ${memory?.facts?.join(', ') || 'None'}.
          Shop Description: ${memory?.shopDescription || 'None'}.
          If the user provides a new fact, you MUST call the saveFactToMemory tool to save it. Then ask the next question. Keep responses very brief and conversational.`,
          tools: [{
            functionDeclarations: [{
              name: 'saveFactToMemory',
              description: 'Save a new fact about the shop to the memory database.',
              parameters: {
                type: Type.OBJECT,
                properties: { fact: { type: Type.STRING, description: 'The fact to save' } },
                required: ['fact']
              }
            }]
          }]
        }
      });

      // Replay history
      for (const m of messages) {
        if (m.role === 'user') await chat.sendMessage({ message: m.text });
        // Model messages are tricky to replay with tools, so we just send the latest context
      }

      const response = await chat.sendMessage({ message: userMsg });
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'saveFactToMemory') {
            const fact = (call.args as any).fact;
            if (fact) {
              await updateMemory({ facts: [...(memory?.facts || []), fact] });
            }
          }
        }
        // Get the text response after tool call
        setMessages(prev => [...prev, { role: 'model', text: response.text || "Got it. I've saved that to memory. What else can you tell me?" }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.role === 'user' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white border border-stone-200 text-stone-800 rounded-bl-none shadow-sm'}`}>
              <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
              <Loader2 size={16} className="animate-spin text-orange-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-200 flex gap-2 items-center">
        <button 
          type="button"
          onClick={toggleListening}
          className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
        >
          {isListening ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isListening ? t('listening') : t('answerHere')}
          className="flex-1 px-4 py-2 bg-stone-100 border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white focus:border-orange-500 transition-all text-sm"
        />
        <button type="submit" disabled={loading || (!input.trim() && !isListening)} className="bg-orange-600 text-white p-2 rounded-full hover:bg-orange-700 disabled:opacity-50 transition-colors">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function VoiceTrackingMode({ addTransaction }: { addTransaction: (t: any) => Promise<void> }) {
  const { t, language } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState(t('clickMicToStart'));
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        
        // If final result, process it
        if (event.results[event.results.length - 1].isFinal) {
          processVoiceCommand(event.results[event.results.length - 1][0].transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setStatus(t('micAccessDenied'));
        } else {
          setStatus(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening) {
          recognition.start(); // Keep listening if it was intentionally started
        }
      };

      recognitionRef.current = recognition;
    } else {
      setStatus(t('speechNotSupported'));
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening, language, t]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setStatus(t('stoppedListening'));
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsListening(true);
      setStatus(t('listeningPrompt'));
    }
  };

  const processVoiceCommand = async (text: string) => {
    setStatus(t('processing'));
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Extract the transaction details from this text: "${text}". If it's a valid transaction, call the addTransaction tool.`,
        config: {
          tools: [{
            functionDeclarations: [{
              name: 'addTransaction',
              description: 'Add a new transaction based on voice input.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['Groceries', 'Snacks', 'Beverages', 'Personal Care', 'Household', 'Other'] },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER },
                  gender: { type: Type.STRING, enum: ['Male', 'Female'] },
                  age: { type: Type.STRING, enum: ['Kid', 'Teen', 'Adult'] },
                  vehicle: { type: Type.STRING, enum: ['Car', 'Bike', 'Cycle', 'None'] }
                },
                required: ['productName', 'category', 'price', 'quantity', 'gender', 'age']
              }
            }]
          }]
        }
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'addTransaction') {
            await addTransaction(call.args as any);
            setStatus(`Added: ${(call.args as any).quantity}x ${(call.args as any).productName}`);
            
            // Play tick sound
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
          }
        }
      } else {
        setStatus('Could not understand transaction details. Please try again.');
      }
    } catch (error) {
      console.error(error);
      setStatus('Error processing command.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-stone-50">
      <div className="relative mb-8">
        {isListening && (
          <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20 scale-150"></div>
        )}
        <button 
          onClick={toggleListening}
          className={`relative z-10 p-8 rounded-full shadow-lg transition-all ${isListening ? 'bg-orange-600 text-white scale-110' : 'bg-white text-stone-400 hover:text-orange-500 hover:bg-orange-50'}`}
        >
          {isListening ? <Mic size={48} /> : <MicOff size={48} />}
        </button>
      </div>
      <h3 className="text-xl font-semibold text-stone-800 mb-2">{t('voiceTracking')}</h3>
      <p className="text-stone-500 text-sm max-w-xs mb-6 h-10">{status}</p>
      
      <div className="w-full max-w-md bg-white p-4 rounded-xl border border-stone-200 min-h-[100px] shadow-inner text-left">
        <p className="text-sm text-stone-700 italic">{transcript || t('waitingForSpeech')}</p>
      </div>
    </div>
  );
}

function AnalysisMode({ transactions, memory, updateMemory, analysis, setAnalysis }: { transactions: Transaction[], memory: ShopMemory | null, updateMemory: (u: Partial<ShopMemory>) => Promise<void>, analysis: string, setAnalysis: React.Dispatch<React.SetStateAction<string>> }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const txSummary = transactions.slice(0, 50).map(t => `${t.quantity}x ${t.productName} (₹${t.price}) - ${t.gender} ${t.age}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Analyze the current shop state based on these recent transactions and memory. Provide a clear, easy-to-read lens into what is happening right now. DO NOT provide future steps or strategies here.
        
        Memory Facts: ${memory?.facts?.join(', ') || 'None'}
        Shop Description: ${memory?.shopDescription || 'None'}
        Recent Transactions:
        ${txSummary}
        
        Format as clear markdown with bullet points.`
      });
      setAnalysis(response.text || 'No analysis generated.');
    } catch (error) {
      console.error(error);
      setAnalysis('Error generating analysis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-stone-800">{t('currentStateAnalysis')}</h3>
        <button 
          onClick={generateAnalysis}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-stone-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-orange-500" />}
          {analysis ? t('refresh') : t('analyzeNow')}
        </button>
      </div>
      
      {analysis ? (
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative group">
          <button 
            onClick={handleCopy}
            className="absolute top-4 right-4 p-2 bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy to clipboard"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <div className="prose prose-sm prose-stone max-w-none">
            <Markdown>{analysis}</Markdown>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
          {t('analyzeNowPrompt')}
        </div>
      )}
    </div>
  );
}

function StrategyMode({ transactions, memory, strategy, setStrategy }: { transactions: Transaction[], memory: ShopMemory | null, strategy: string, setStrategy: React.Dispatch<React.SetStateAction<string>> }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(strategy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateStrategy = async () => {
    setLoading(true);
    try {
      const txSummary = transactions.slice(0, 50).map(t => `${t.quantity}x ${t.productName} (₹${t.price}) - ${t.gender} ${t.age}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Based on the shop data and memory, provide actionable strategies and future additions that can be implemented right now. Focus on immediate, practical changes to increase revenue or efficiency.
        
        Memory Facts: ${memory?.facts?.join(', ') || 'None'}
        Shop Description: ${memory?.shopDescription || 'None'}
        Recent Transactions:
        ${txSummary}
        
        Format as clear markdown with bullet points.`
      });
      setStrategy(response.text || 'No strategy generated.');
    } catch (error) {
      console.error(error);
      setStrategy('Error generating strategy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-stone-800">{t('futureStrategy')}</h3>
        <button 
          onClick={generateStrategy}
          disabled={loading}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
          {strategy ? t('refresh') : t('generateStrategy')}
        </button>
      </div>
      
      {strategy ? (
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative group">
          <button 
            onClick={handleCopy}
            className="absolute top-4 right-4 p-2 bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy to clipboard"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <div className="prose prose-sm prose-stone max-w-none">
            <Markdown>{strategy}</Markdown>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
          {t('generateStrategyPrompt')}
        </div>
      )}
    </div>
  );
}
