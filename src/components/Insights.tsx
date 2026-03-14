import React, { useMemo, useState } from 'react';
import { Transaction } from '../store';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { BarChart3, Wand2, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useLanguage } from '../LanguageContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const COLORS = ['#ea580c', '#dc2626', '#f59e0b', '#b91c1c', '#f97316', '#ef4444'];

export function Insights({ transactions, onClear, updateTransaction }: { transactions: Transaction[], onClear: () => void, updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void> }) {
  const { t } = useLanguage();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const stats = useMemo(() => {
    if (!transactions.length) return null;

    const totalRevenue = transactions.reduce((sum, t) => sum + t.price, 0);
    const avgIncome = totalRevenue / transactions.length;

    // 1. Top Products (Case-insensitive grouping)
    const productCounts = transactions.reduce((acc, t) => {
      const normalizedName = t.productName.trim().toLowerCase();
      // Capitalize first letter for display
      const displayName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
      acc[displayName] = (acc[displayName] || 0) + (t.quantity || 1);
      return acc;
    }, {} as Record<string, number>);
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // 2. Categories by Gender
    const catByGender = transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = { category: t.category, Male: 0, Female: 0 };
      acc[t.category][t.gender] += (t.quantity || 1);
      return acc;
    }, {} as Record<string, any>);

    // 3. Categories by Age
    const catByAge = transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = { category: t.category, Kid: 0, Teen: 0, Adult: 0 };
      acc[t.category][t.age] += (t.quantity || 1);
      return acc;
    }, {} as Record<string, any>);

    // 4. Peak Time by Gender
    const timeByGender = transactions.reduce((acc, t) => {
      const hour = new Date(t.timestamp).getHours();
      const hourLabel = `${hour % 12 || 12}${hour >= 12 ? 'PM' : 'AM'}`;
      if (!acc[hourLabel]) acc[hourLabel] = { time: hourLabel, Male: 0, Female: 0, hour };
      acc[hourLabel][t.gender]++;
      return acc;
    }, {} as Record<string, any>);
    
    const peakTimeData = Object.values(timeByGender).sort((a, b) => a.hour - b.hour);

    // 5. Customer Ratio by Gender
    const genderCounts = transactions.reduce((acc, t) => {
      acc[t.gender] = (acc[t.gender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const genderRatioData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }));

    return {
      totalRevenue,
      avgIncome,
      topProducts,
      catByGender: Object.values(catByGender),
      catByAge: Object.values(catByAge),
      peakTimeData,
      genderRatioData
    };
  }, [transactions]);

  const handleFixData = async () => {
    if (transactions.length === 0) return;
    setIsFixing(true);
    try {
      // Get all unique product names
      const uniqueNames = Array.from(new Set(transactions.map(t => t.productName)));
      
      const prompt = `
        I have a list of product names entered by a user in a shop management app. 
        Some might have spelling mistakes, inconsistent casing, or slight variations (e.g., "pne" instead of "Pen", "milk 1 ltr" vs "Milk 1L").
        Please normalize and fix these names. Group similar items under a single, correctly spelled, capitalized name.
        
        Return ONLY a valid JSON object where the keys are the original names and the values are the fixed, normalized names.
        Do not include markdown blocks like \`\`\`json. Just the raw JSON object.
        
        Original names:
        ${JSON.stringify(uniqueNames)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text || '{}';
      const mapping = JSON.parse(text);

      // Apply updates
      const updatePromises = transactions.map(t => {
        const fixedName = mapping[t.productName];
        if (fixedName && fixedName !== t.productName && t.id) {
          return updateTransaction(t.id, { productName: fixedName });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error fixing data:", error);
      alert("Failed to fix data. Please try again.");
    } finally {
      setIsFixing(false);
    }
  };

  if (!stats) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stone-200 text-stone-400 mb-4">
          <BarChart3 size={32} />
        </div>
        <h3 className="text-lg font-medium text-stone-900">{t('noData')}</h3>
        <p className="text-stone-500 mt-1">{t('recordPurchases')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">{t('insights')}</h2>
          <p className="text-stone-500">Based on {transactions.length} recorded transactions</p>
        </div>
        {showClearConfirm ? (
          <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
            <span className="text-sm text-red-800 font-medium">{t('areYouSure')}</span>
            <button onClick={() => { onClear(); setShowClearConfirm(false); }} className="text-sm text-red-600 font-bold hover:underline">{t('yes')}</button>
            <button onClick={() => setShowClearConfirm(false)} className="text-sm text-stone-600 font-medium hover:underline">{t('no')}</button>
          </div>
        ) : (
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
          >
            {t('clearData')}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">{t('totalCustomers')}</p>
          <p className="text-3xl font-light text-stone-900 mt-2">{transactions.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">{t('totalRevenue')}</p>
          <p className="text-3xl font-light text-stone-900 mt-2">₹{stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">{t('avgOrderValue')}</p>
          <p className="text-3xl font-light text-stone-900 mt-2">₹{stats.avgIncome.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Ratio */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-semibold text-stone-800 mb-4">{t('customerRatio')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.genderRatioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.genderRatioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Time */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-semibold text-stone-800 mb-4">{t('peakTime')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.peakTimeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Male" stroke="#ea580c" strokeWidth={2} />
                <Line type="monotone" dataKey="Female" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories by Gender */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-semibold text-stone-800 mb-4">{t('categoriesByGender')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.catByGender}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Male" stackId="a" fill="#ea580c" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Female" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories by Age */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-semibold text-stone-800 mb-4">{t('categoriesByAge')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.catByAge}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Kid" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Teen" stackId="a" fill="#ea580c" />
                <Bar dataKey="Adult" stackId="a" fill="#b91c1c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-stone-800">{t('topProducts')}</h3>
          <button 
            onClick={handleFixData}
            disabled={isFixing}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            title="Fix spelling mistakes and group similar products"
          >
            {isFixing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {t('fixData')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 font-medium">{t('rank')}</th>
                <th className="px-4 py-3 font-medium">{t('productName')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('timesBought')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.topProducts.map(([name, count], idx) => (
                <tr key={name} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <td className="px-4 py-3 text-stone-500">#{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-stone-900">{name}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
