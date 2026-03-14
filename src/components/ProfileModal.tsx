import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, BrainCircuit, Languages } from 'lucide-react';
import { ShopMemory } from '../store';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { useLanguage } from '../LanguageContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: ShopMemory | null;
  updateMemory: (updates: Partial<ShopMemory>) => Promise<void>;
}

export function ProfileModal({ isOpen, onClose, memory, updateMemory }: ProfileModalProps) {
  const { language, setLanguage, t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (files.length > 4) {
      alert("You can only upload a maximum of 4 photos at a time.");
      return;
    }

    setUploading(true);
    try {
      const parts = [];
      const compressedPhotos: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImage(file);
        compressedPhotos.push(compressedBase64);
        
        parts.push({
          inlineData: {
            data: compressedBase64.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      }

      parts.push({ text: "Describe this shop in detail based on these images. Focus on layout, products visible, scale, condition, and any notable features. IMPORTANT: Speak directly to the user in a helpful, conversational tone. For example: 'You have a well-organized shop that features...', 'I can see that your main counter is...'. Do NOT sound like an API or a robot. Be detailed but friendly." });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts }
      });

      const newDescription = response.text || '';
      if (newDescription) {
        await updateMemory({ 
          shopDescription: newDescription,
          photos: compressedPhotos
        });
      }
    } catch (error) {
      console.error("Error processing images:", error);
      alert("Failed to process images. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BrainCircuit className="text-orange-500" />
            {t('shopMemoryProfile')}
          </h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Image Upload Section */}
          <section>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">{t('visualMemory')}</h3>
            <div className="bg-stone-50 border border-stone-200 border-dashed rounded-xl p-6 text-center">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                  {uploading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">{t('uploadPhotos')}</p>
                  <p className="text-xs text-stone-500 mt-1">{t('maxPhotos')}. AI will analyze and store the description.</p>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload size={16} />
                  {uploading ? t('processing') : 'Select Photos'}
                </button>
              </div>
            </div>
            
            {memory?.photos && memory.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {memory.photos.map((photo, i) => (
                  <img key={i} src={photo} alt={`Shop photo ${i+1}`} className="w-full h-24 object-cover rounded-lg border border-stone-200" />
                ))}
              </div>
            )}
            
            {memory?.shopDescription && (
              <div className="mt-4 bg-orange-50/50 border border-orange-100 p-4 rounded-xl">
                <h4 className="text-xs font-semibold text-orange-800 mb-2">{t('currentDescription')}</h4>
                <div className="text-sm text-stone-700 leading-relaxed prose prose-sm prose-stone max-w-none">
                  <Markdown>{memory.shopDescription}</Markdown>
                </div>
              </div>
            )}
          </section>

          {/* Facts Section */}
          <section>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">{t('learnedFacts')}</h3>
            {memory?.facts && memory.facts.length > 0 ? (
              <ul className="space-y-2">
                {memory.facts.map((fact, i) => (
                  <li key={i} className="bg-white border border-stone-200 p-3 rounded-lg text-sm text-stone-700 flex items-start gap-3 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></div>
                    {fact}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center p-6 bg-stone-50 rounded-xl border border-stone-200 text-stone-500 text-sm">
                No facts learned yet. Use the Investigator mode to teach the AI about your shop.
              </div>
            )}
          </section>

          {/* Language Switcher Section */}
          <section className="pt-4 border-t border-stone-100">
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Languages size={16} className="text-orange-500" />
              {t('language')}
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${
                  language === 'en' 
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                <span className="text-lg">🇺🇸</span>
                {t('english')}
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${
                  language === 'hi' 
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                <span className="text-lg">🇮🇳</span>
                {t('hindi')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
