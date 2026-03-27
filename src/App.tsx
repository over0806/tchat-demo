/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  X,
  MapPin,
  CreditCard,
  ChevronRight,
  Plus,
  Send,
  Camera,
  FileText,
  QrCode,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';

type Tab = 'intro' | 'match';

interface Job {
  id: string;
  title: string;
  category: string;
  location: string;
  salary: string;
  description: string[];
  requirements: string[];
  count: number;
}



// 自動偵測環境，若是本地開發則指向 8000 埠號，若是 Vercel 部署則使用相對路徑
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8000'
  : '';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('match');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [inputText, setInputText] = useState('');
  const [introMessages, setIntroMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [matchMessages, setMatchMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [isFiltered, setIsFiltered] = useState(false);
  const [introIsChatting, setIntroIsChatting] = useState(false);
  const [matchIsChatting, setMatchIsChatting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuickBtn, setActiveQuickBtn] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [displayJobs, setDisplayJobs] = useState<Job[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Fetch jobs from backend
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/jobs`);
        const data = await res.json();
        setAllJobs(data);
        setDisplayJobs(data.slice(0, 4));
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      }
    };
    fetchJobs();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initial Greeting
  useEffect(() => {
    if (activeTab === 'intro') {
      setIntroIsChatting(true);
      if (introMessages.length === 0) {
        setIntroMessages([{
          role: 'model',
          text: "您好！我是導覽員。歡迎來到台泥展區！您可以探索「鸚鵡螺號」設計理念或查看地圖。有什麼想了解的嗎？🚢"
        }]);
      }
    } else if (activeTab === 'match') {
      setMatchIsChatting(true);
      if (matchMessages.length === 0) {
        setMatchMessages([{
          role: 'model',
          text: "您好！我是台泥招募顧問。很高興能協助您！您可以詢問職缺詳情或企業文化。準備好開始了嗎？💼"
        }]);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [introMessages, matchMessages, isLoading]);

  const handleSendMessage = async (text?: string, isQuickBtn: boolean = false) => {
    const userMessage = (text || inputText).trim();
    if (!userMessage || isLoading) return;

    if (isQuickBtn) {
      setActiveQuickBtn(userMessage);
    } else {
      setActiveQuickBtn(null);
    }

    // Filter jobs based on message keywords
    const filterJobs = () => {
      const lowerMsg = userMessage.toLowerCase();
      let filtered: Job[] = [];

      if (lowerMsg.includes('熱門職缺')) {
        filtered = allJobs.slice(0, 4);
      } else if (lowerMsg.includes('ma') || lowerMsg.includes('儲備幹部')) {
        filtered = allJobs.filter(j => j.category === 'MA' || j.title.includes('MA'));
      } else if (lowerMsg.includes('環工')) {
        filtered = allJobs.filter(j => j.category === 'Environmental' || j.title.includes('環工'));
      } else if (lowerMsg.includes('資訊') || lowerMsg.includes('數位') || lowerMsg.includes('轉型')) {
        filtered = allJobs.filter(j =>
          j.title.includes('資訊') || j.title.includes('數位') || j.title.includes('轉型') ||
          j.description.some(d => d.includes('資訊') || d.includes('數位') || d.includes('轉型'))
        );
      } else {
        // General search
        filtered = allJobs.filter(j =>
          j.title.toLowerCase().includes(lowerMsg) ||
          j.description.some(d => d.toLowerCase().includes(lowerMsg)) ||
          j.category.toLowerCase().includes(lowerMsg)
        );
      }

      if (filtered.length > 0 && !lowerMsg.includes('熱門職缺')) {
        setIsFiltered(true);
        return filtered;
      } else {
        setIsFiltered(false);
        return allJobs.slice(0, 4);
      }
    };

    setInputText('');

    let updatedMessages: { role: 'user' | 'model'; text: string }[] = [];
    if (activeTab === 'intro') {
      updatedMessages = [...introMessages, { role: 'user', text: userMessage }];
      setIntroMessages(updatedMessages);
      setIntroIsChatting(true);
    } else {
      updatedMessages = [...matchMessages, { role: 'user', text: userMessage }];
      setMatchMessages(updatedMessages);
      setMatchIsChatting(true);
    }

    setIsLoading(true);

    // Scroll to bottom immediately when user sends message
    setTimeout(scrollToBottom, 100);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          tab: activeTab
        })
      });

      if (!res.ok) throw new Error('Backend error');

      const data = await res.json();
      const modelResponse = data.text || "抱歉，我現在無法回答。";

      if (activeTab === 'intro') {
        setIntroMessages(prev => [...prev, { role: 'model', text: modelResponse }]);
      } else {
        setMatchMessages(prev => [...prev, { role: 'model', text: modelResponse }]);
        // Update job list after AI response
        setDisplayJobs(filterJobs());
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = error instanceof Error ? `連線錯誤: ${error.message}` : "發生未知錯誤，請檢查後端是否啟動。";
      if (activeTab === 'intro') {
        setIntroMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
      } else {
        setMatchMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative overflow-x-hidden bg-black/40 backdrop-blur-md border-x border-white/10 shadow-2xl">
      {/* Background Overlay for Intro */}
      {activeTab === 'intro' && (
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_0%,transparent_100%)]" />
      )}

      {/* Header */}
      <header className="pt-8 pb-4 text-center shrink-0">
        <h1 className="text-3xl font-bold tracking-widest text-gray-200 font-headline">台泥校園徵才</h1>
      </header>

      {/* Navigation Toggle */}
      <nav className="px-6 mb-8 shrink-0">
        <div className="relative flex justify-center items-center">
          <div className="nautilus-toggle w-full">
            <button
              onClick={() => {
                if (activeTab !== 'intro') {
                  setActiveTab('intro');
                }
              }}
              className={cn(
                "toggle-tab",
                activeTab === 'intro' && "toggle-tab-active"
              )}
            >
              <img
                src="tab-intro.png"
                alt="展場簡介"
                className="w-7 h-7 mr-2 object-contain"
                style={activeTab === 'intro'
                  ? { filter: 'sepia(100%) saturate(2000%) hue-rotate(10deg) brightness(100%)' }
                  : { filter: 'brightness(0) invert(0.6)' }
                }
              />
              <span className="font-medium">展場簡介</span>
            </button>
            <button
              onClick={() => {
                if (activeTab !== 'match') {
                  setActiveTab('match');
                }
              }}
              className={cn(
                "toggle-tab",
                activeTab === 'match' && "toggle-tab-active"
              )}
            >
              <img
                src="tab-jobs.png"
                alt="職缺媒合"
                className="w-7 h-7 mr-2 object-contain"
                style={activeTab === 'match'
                  ? {}
                  : { filter: 'brightness(0) invert(0.6)' }
                }
              />
              <span className="font-medium">職缺媒合</span>
            </button>
          </div>
          {/* Center Nautilus Icon */}
          <div className="absolute left-1/2 -translate-x-1/2 z-10">
            <div className="bg-gray-800 rounded-full p-1 border-2 border-amber-gold/50 shadow-lg">
              <img
                src="Nautilus.png"
                alt="Nautilus Shell"
                className="w-10 h-10 object-contain scale-110"
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="flex-1 px-6 pb-64 overflow-y-auto relative no-scrollbar"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'intro' ? (
            introIsChatting ? (
              <motion.div
                key="intro-chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-8 pt-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-amber-gold font-bold tracking-widest text-sm uppercase">AI 導覽對話</h3>
                  <button
                    onClick={() => {
                      setIntroIsChatting(false);
                    }}
                    className="text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    [ 查看設計理念 ]
                  </button>
                </div>

                <div className="space-y-8">
                  {introMessages.map((m, i) => (
                    <div key={i} className={cn(
                      "flex flex-col",
                      m.role === 'user' ? "items-end" : "items-start"
                    )}>
                      {m.role === 'user' ? (
                        <div className="bg-amber-gold text-black px-4 py-2 rounded-lg text-sm shadow-lg font-medium max-w-[80%]">
                          {m.text}
                        </div>
                      ) : (
                        <div className="space-y-4 w-full">
                          <div className="text-gray-300 leading-relaxed tracking-wide text-base markdown-body">
                            <Markdown>{m.text}</Markdown>
                          </div>
                          {i < introMessages.length - 1 && <div className="h-px bg-white/5 w-full" />}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>

                {isLoading && (
                  <div className="flex items-center gap-3 text-gray-500 text-xs italic tracking-widest">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-amber-gold rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-amber-gold rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1 h-1 bg-amber-gold rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    導覽員正在準備回覆...
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="intro"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="flex justify-end">
                  <div className="bg-amber-gold text-black px-4 py-1.5 rounded-lg text-base shadow-lg">鸚鵡螺號</div>
                </div>

                <div className="space-y-6 text-gray-300 leading-relaxed tracking-wide">
                  <p>
                    想像在 150 多年前，<br />
                    當世界還沒有真正的現代潛水艇時，有一位作家寫出了一艘能長時間潛入深海、用電力航行、探索未知世界的未來潛艇。
                  </p>
                  <p>那就是鸚鵡螺號。</p>
                </div>

                <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
                  <img
                    src="pic01.png"
                    alt="Project Nautilus Exhibit"
                    className="w-full h-auto object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="text-gray-300 leading-relaxed tracking-wide">
                  <p>
                    它完美融合了維多利亞時代的復古機械工藝與未來的全息投影技術。在這片名為「職場」的廣闊深海裡，同仁們是充滿潛力的探險家，而鸚鵡螺號就是那位沉穩、睿智且配備頂尖科技的專屬導航員。
                  </p>
                </div>
              </motion.div>
            )
          ) : (
            <motion.div
              key="match"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6 pt-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-amber-gold font-bold tracking-widest text-sm uppercase">AI 招募對話</h3>
                {matchIsChatting && (
                  <button
                    onClick={() => {
                      setMatchIsChatting(false);
                      setMatchMessages([]);
                      setDisplayJobs(allJobs.slice(0, 4));
                    }}
                    className="text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    [ 結束對話 ]
                  </button>
                )}
              </div>

              <div className="space-y-8">
                {/* Show full message history */}
                {matchMessages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex flex-col",
                    m.role === 'user' ? "items-end" : "items-start"
                  )}>
                    {m.role === 'user' ? (
                      <div className="bg-amber-gold text-black px-4 py-2 rounded-lg text-sm shadow-lg font-medium max-w-[80%]">
                        {m.text}
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        <div className="text-gray-300 leading-relaxed tracking-wide text-base markdown-body">
                          <Markdown>{m.text}</Markdown>
                        </div>
                        {i < matchMessages.length - 1 && <div className="h-px bg-white/5 w-full" />}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && activeTab === 'match' && (
                  <div className="flex items-center gap-3 text-amber-gold/60 text-sm italic tracking-widest animate-pulse">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-amber-gold rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-amber-gold rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1 h-1 bg-amber-gold rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    顧問正在為您分析職缺...
                  </div>
                )}

                {!isLoading && displayJobs.some(j => j.category === 'MA' || j.title.includes('MA')) && (
                  <div className="flex items-center space-x-1 text-amber-gold">
                    <a href="https://www.taiwancement.com/tw/ma.html" target="_blank" rel="noreferrer" className="underline decoration-amber-gold/50 text-base">台灣水泥儲備幹部計畫</a>
                  </div>
                )}
              </div>

              {!isLoading && (
                <section className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <h4 className="text-amber-gold/80 text-xs font-bold tracking-widest uppercase">
                      {isFiltered ? '為您推薦的職缺' : '熱門職缺'}
                    </h4>
                    {!isFiltered && <span className="text-[10px] text-gray-500 italic">精選推薦</span>}
                  </div>
                  <div className="space-y-3">
                    {displayJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className="w-full bg-[#E8E6E1] text-black px-5 py-4 rounded-2xl flex justify-between items-center shadow-md text-left active:scale-[0.98] transition-all hover:bg-[#F2F0EB]"
                      >
                        <span className="font-bold text-base pr-4">{job.title}</span>
                        <ChevronRight className="h-6 w-6 text-amber-gold shrink-0" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <div ref={scrollRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Chat Bar */}
      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-6 pb-8 pt-48 bg-gradient-to-t from-black via-black/90 to-transparent z-50 pointer-events-none">
        <div className="pointer-events-auto relative">
          {/* Scroll to Bottom Button */}
          <AnimatePresence>
            {showScrollBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                onClick={scrollToBottom}
                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-gold text-black p-2 rounded-full shadow-lg hover:bg-amber-gold/80 transition-colors z-[60]"
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </motion.button>
            )}
          </AnimatePresence>
          {/* Menu Overlay */}
          <AnimatePresence>
            {showMenu && activeTab !== 'intro' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-3xl mb-4 p-4 flex justify-around items-center"
              >
                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-gray-700/50 flex items-center justify-center text-amber-gold group-active:bg-amber-gold group-active:text-black transition-all">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-gray-300 text-xs">相機</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-gray-700/50 flex items-center justify-center text-amber-gold group-active:bg-amber-gold group-active:text-black transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-gray-300 text-xs">檔案</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-gray-700/50 flex items-center justify-center text-amber-gold group-active:bg-amber-gold group-active:text-black transition-all">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <span className="text-gray-300 text-xs">QR code</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Access Pills */}
          {!showMenu && (
            <div className="flex justify-start gap-2 mb-4 overflow-x-auto no-scrollbar py-2">
              {(activeTab === 'intro' ? [
                { id: 'map', label: '導覽地圖' },
                { id: 'concept', label: '設計理念' },
                { id: 'nautilus', label: '鸚鵡螺號' }
              ] : [
                { id: 'hot', label: '熱門職缺' },
                { id: 'env', label: '環工背景' },
                { id: 'ma', label: 'MA 儲備幹部' }
              ]).map((btn) => (
                <motion.button
                  key={btn.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSendMessage(btn.label, true)}
                  className={cn(
                    "px-4 py-1.5 rounded-full border text-xs transition-all whitespace-nowrap",
                    activeQuickBtn === btn.label
                      ? "border-amber-gold text-amber-gold bg-amber-gold/10 shadow-[0_0_10px_rgba(217,119,6,0.2)]"
                      : "border-gray-500 text-gray-300 bg-black/40 hover:border-amber-gold/50"
                  )}
                >
                  {btn.label}
                </motion.button>
              ))}
            </div>
          )}

          {/* Chat Input */}
          <div className="bg-gray-900/90 backdrop-blur-md rounded-full px-5 py-2 flex items-center gap-3 border border-white/5">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="問問 AI 導覽員"
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500"
            />
            <div className="flex items-center gap-2">
              {activeTab !== 'intro' && (
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    showMenu ? "bg-amber-gold text-black rotate-45" : "bg-gray-700 text-white"
                  )}
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isLoading ? "bg-gray-800 text-gray-600" : "bg-gray-700 text-white hover:bg-gray-600"
                )}
              >
                <Send className="w-5 h-5 rotate-45" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJob(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-10 pt-10 pb-4 flex justify-between items-start shrink-0">
                <h2 className="text-[1.35rem] font-bold text-[#d97706] leading-tight pr-8">
                  {selectedJob.title}
                </h2>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="h-8 w-8 flex items-center justify-center text-neutral-900 hover:opacity-60 transition-opacity"
                >
                  <X className="w-8 h-8 font-light" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-10 pb-4 space-y-8">
                <section className="space-y-3">
                  <h3 className="text-neutral-900 font-bold text-xl tracking-tight">工作內容</h3>
                  <div className="space-y-1.5 text-neutral-600 text-base leading-[1.8]">
                    {selectedJob.description.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </section>

                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <h4 className="text-neutral-900 font-bold text-lg whitespace-nowrap min-w-[5rem]">需求人數</h4>
                    <p className="text-neutral-500 text-base">{selectedJob.count}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <h4 className="text-neutral-900 font-bold text-lg whitespace-nowrap min-w-[5rem]">薪資待遇</h4>
                    <p className="text-neutral-500 text-base">{selectedJob.salary}</p>
                  </div>
                  <div className="flex items-start gap-6">
                    <h4 className="text-neutral-900 font-bold text-lg whitespace-nowrap min-w-[5rem]">上班地點</h4>
                    <p className="text-neutral-500 text-base">{selectedJob.location}</p>
                  </div>
                </div>

                <section className="space-y-4">
                  <h3 className="text-neutral-900 font-bold text-xl tracking-tight">條件要求</h3>
                  <div className="space-y-4 text-neutral-500 text-base leading-relaxed">
                    {selectedJob.requirements.map((req, i) => (
                      <p key={i}>{req}</p>
                    ))}
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="px-10 pb-10 pt-4 shrink-0">
                <button className="w-full bg-[#e67e22] text-white py-4 rounded-full font-bold text-2xl shadow-lg active:scale-[0.98] transition-all">
                  我要應徵
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
