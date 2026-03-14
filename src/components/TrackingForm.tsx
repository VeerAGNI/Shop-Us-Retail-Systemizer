import React, { useState, useMemo, useCallback } from 'react';
import { CheckCircle2, Flame, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Transaction } from '../store';
import { useLanguage } from '../LanguageContext';

const CATEGORIES = ['Groceries', 'Snacks', 'Beverages', 'Personal Care', 'Household', 'Other'];

// Temporary preset products
const PRESET_PRODUCTS = [
  "Milk 1L", "Bread", "Eggs", "Lays Classic", "Coca Cola 500ml", 
  "Lifebuoy Soap", "Surf Excel", "Maggi 70g", "Parle-G", "Amul Butter"
];

export function TrackingForm({ onSubmit, transactions }: { onSubmit: (data: any) => void, transactions: Transaction[] }) {
  const { t } = useLanguage();
  const [showSuccess, setShowSuccess] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  
  const playTick = useCallback(() => {
    try {
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
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, []);

  const filteredProducts = PRESET_PRODUCTS.filter(p => 
    p.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleProductChange = (name: string) => {
    setProductSearch(name);
    // Find last transaction with same product name to auto-fill price
    const lastTx = transactions.find(t => t.productName.toLowerCase() === name.toLowerCase());
    if (lastTx) {
      setUnitPrice(lastTx.price / lastTx.quantity);
    } else {
      setUnitPrice('');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    onSubmit({
      productName: productSearch || (formData.get('productName') as string),
      category: formData.get('category') as string,
      price: Number(formData.get('price')),
      quantity: Number(formData.get('quantity')),
      gender: formData.get('gender') as string,
      age: formData.get('age') as string,
      vehicle: formData.get('vehicle') as string || undefined,
    });

    playTick();
    e.currentTarget.reset();
    setProductSearch('');
    setQuantity(1);
    setUnitPrice('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  // Calculate today's hourly trend for the mini graph
  const todayTrend = useMemo(() => {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayTx = transactions.filter(t => t.timestamp >= todayStart.getTime());
    
    // Create 24 hours slots
    const hourly = Array.from({length: 24}, (_, i) => {
      const hour = i;
      const label = `${hour % 12 || 12}${hour >= 12 ? 'PM' : 'AM'}`;
      return { 
        time: label, 
        count: 0, 
        hour 
      };
    });

    todayTx.forEach(t => {
      const h = new Date(t.timestamp).getHours();
      const slot = hourly.find(x => x.hour === h);
      if (slot) slot.count++;
    });

    // Filter to show a reasonable window (e.g., 6 AM to 11 PM) or just the whole day
    return hourly.filter(h => h.hour >= 6 && h.hour <= 22);
  }, [transactions]);

  const todayTotal = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return transactions.filter(t => t.timestamp >= todayStart.getTime()).length;
  }, [transactions]);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Mini Graph Section */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-md overflow-hidden text-white">
        <div className="p-5 pb-2 flex justify-between items-center">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Flame size={18} className="text-yellow-300" />
              {t('dashboard')}
            </h3>
            <p className="text-orange-100 text-sm mt-1">{todayTotal} {t('totalCustomers')} {t('dashboard').toLowerCase()}</p>
          </div>
          <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
            <TrendingUp size={20} className="text-white" />
          </div>
        </div>
        <div className="h-24 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={todayTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fde047" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#fde047" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                hide={false} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 8 }}
                interval={3}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1c1917', border: 'none', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#fde047' }}
                cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
              />
              <Area type="monotone" dataKey="count" stroke="#fde047" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tracking Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-xl font-semibold text-stone-800">{t('addTransaction')}</h2>
          <p className="text-sm text-stone-500 mt-1">{t('recordPurchases')}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 relative">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">{t('productName')}</label>
              <input 
                required
                name="productName"
                type="text" 
                value={productSearch}
                onChange={(e) => {
                  handleProductChange(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="e.g. Milk 1L"
                autoComplete="off"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {showSuggestions && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <div 
                      key={p} 
                      className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm text-stone-700 font-medium"
                      onClick={() => {
                        handleProductChange(p);
                        setShowSuggestions(false);
                      }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">{t('quantity')}</label>
              <input 
                required
                name="quantity"
                type="number" 
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">{t('price')} (₹)</label>
              <input 
                required
                name="price"
                type="number" 
                min="0"
                step="0.01"
                value={unitPrice !== '' ? unitPrice * quantity : ''}
                onChange={(e) => setUnitPrice(Number(e.target.value) / quantity)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">{t('category')}</label>
              <select 
                required
                name="category"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              >
                <option value="">Select a category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(c.toLowerCase().replace(' ', '') as any)}</option>)}
              </select>
            </div>
          </div>

          <div className="h-px bg-stone-100 my-2"></div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t('gender')}</label>
              <div className="flex gap-3">
                {['Male', 'Female'].map(g => (
                  <label key={g} className="flex-1 cursor-pointer">
                    <input type="radio" name="gender" value={g} required className="peer sr-only" />
                    <div className="text-center px-4 py-2 rounded-lg border border-stone-200 bg-stone-50 peer-checked:bg-orange-50 peer-checked:border-orange-500 peer-checked:text-orange-700 font-medium text-sm transition-all">
                      {t(g.toLowerCase() as any)}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t('age')}</label>
              <div className="flex gap-3">
                {['Kid', 'Teen', 'Adult'].map(a => (
                  <label key={a} className="flex-1 cursor-pointer">
                    <input type="radio" name="age" value={a} required className="peer sr-only" />
                    <div className="text-center px-4 py-2 rounded-lg border border-stone-200 bg-stone-50 peer-checked:bg-orange-50 peer-checked:border-orange-500 peer-checked:text-orange-700 font-medium text-sm transition-all">
                      {t(a.toLowerCase() as any)}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t('vehicle')} ({t('none')})</label>
              <div className="flex gap-3">
                {['None', 'Cycle', 'Bike', 'Car'].map(v => (
                  <label key={v} className="flex-1 cursor-pointer">
                    <input type="radio" name="vehicle" value={v} className="peer sr-only" />
                    <div className="text-center px-2 py-2 rounded-lg border border-stone-200 bg-stone-50 peer-checked:bg-orange-50 peer-checked:border-orange-500 peer-checked:text-orange-700 font-medium text-sm transition-all">
                      {t(v.toLowerCase() as any)}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {showSuccess ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>{t('added')}</span>
                </>
              ) : (
                <>
                  <Flame size={18} />
                  <span>{t('addTransaction')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
