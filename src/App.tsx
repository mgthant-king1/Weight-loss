import React, { useState, useEffect } from 'react';
import { 
  Home, 
  BookOpen, 
  Utensils, 
  Dumbbell, 
  LineChart, 
  User as UserIcon,
  LogOut,
  Menu,
  X,
  TrendingDown,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logOut, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { TIPS, FOODS, EXERCISES } from './constants';
import { UserProfile, ProgressEntry } from './types';
import { cn, OperationType, handleFirestoreError } from './lib/utils';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
        : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white border border-slate-100 rounded-3xl p-6 shadow-sm", className)}>
    {children}
  </div>
);

// --- Pages ---

const Dashboard = ({ profile, progress }: { profile: UserProfile, progress: ProgressEntry[] }) => {
  const chartData = progress.map(p => ({
    date: format(p.date.toDate(), 'MMM dd'),
    weight: p.weight
  })).reverse();

  const currentWeight = progress[0]?.weight || profile.currentWeight || 0;
  const targetWeight = profile.targetWeight || 0;
  const lost = profile.currentWeight ? profile.currentWeight - currentWeight : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 rounded-2xl text-white">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-emerald-800 text-sm font-medium">လက်ရှိဝိတ်</p>
              <p className="text-2xl font-bold text-emerald-950">{currentWeight} kg</p>
            </div>
          </div>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white">
              <LineChart size={24} />
            </div>
            <div>
              <p className="text-blue-800 text-sm font-medium">ရည်မှန်းချက်</p>
              <p className="text-2xl font-bold text-blue-950">{targetWeight} kg</p>
            </div>
          </div>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-600 rounded-2xl text-white">
              <Info size={24} />
            </div>
            <div>
              <p className="text-amber-800 text-sm font-medium">ကျဆင်းမှု</p>
              <p className="text-2xl font-bold text-amber-950">{lost.toFixed(1)} kg</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="h-80">
        <h3 className="text-lg font-bold text-slate-800 mb-4">တိုးတက်မှုပြဇယား</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="#059669" 
                strokeWidth={3} 
                dot={{r: 4, fill: '#059669', strokeWidth: 2, stroke: '#fff'}} 
                activeDot={{r: 6}}
              />
            </ReLineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            မှတ်တမ်းများ မရှိသေးပါ။
          </div>
        )}
      </Card>
    </div>
  );
};

const TipsPage = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {TIPS.map((tip, i) => (
      <Card key={i} className="hover:border-emerald-200 transition-colors">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-2">{tip.title}</h4>
            <p className="text-slate-600 text-sm leading-relaxed">{tip.content}</p>
            <span className="inline-block mt-3 px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] uppercase tracking-wider font-bold">
              {tip.category}
            </span>
          </div>
        </div>
      </Card>
    ))}
  </div>
);

const DietPage = () => (
  <div className="space-y-8">
    <section>
      <h3 className="text-xl font-bold text-emerald-700 mb-4 flex items-center gap-2">
        <div className="w-2 h-8 bg-emerald-500 rounded-full" />
        စားသုံးရန် (Eat)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FOODS.filter(f => f.type === 'eat').map((food, i) => (
          <Card key={i} className="border-l-4 border-l-emerald-500">
            <h4 className="font-bold text-slate-800">{food.name}</h4>
            <p className="text-slate-600 text-sm">{food.description}</p>
          </Card>
        ))}
      </div>
    </section>
    <section>
      <h3 className="text-xl font-bold text-rose-700 mb-4 flex items-center gap-2">
        <div className="w-2 h-8 bg-rose-500 rounded-full" />
        ရှောင်ကြဉ်ရန် (Avoid)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FOODS.filter(f => f.type === 'avoid').map((food, i) => (
          <Card key={i} className="border-l-4 border-l-rose-500">
            <h4 className="font-bold text-slate-800">{food.name}</h4>
            <p className="text-slate-600 text-sm">{food.description}</p>
          </Card>
        ))}
      </div>
    </section>
  </div>
);

const ExercisePage = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {EXERCISES.map((ex, i) => (
      <Card key={i} className="overflow-hidden p-0 group">
        <div className="aspect-video bg-emerald-100 relative">
          <img 
            src={`https://picsum.photos/seed/${ex.name}/600/400`} 
            alt={ex.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-emerald-700 shadow-sm">
            {ex.duration}
          </div>
        </div>
        <div className="p-6">
          <h4 className="font-bold text-lg text-slate-800 mb-2">{ex.name}</h4>
          <p className="text-slate-600 text-sm">{ex.description}</p>
        </div>
      </Card>
    ))}
  </div>
);

const TrackerPage = ({ user, profile, onSave }: { user: User, profile: UserProfile, onSave: () => void }) => {
  const [weight, setWeight] = useState(profile.currentWeight?.toString() || '');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState(profile.targetWeight?.toString() || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) return;
    setLoading(true);

    try {
      // Create progress entry
      const progressPath = `users/${user.uid}/progress`;
      try {
        await addDoc(collection(db, progressPath), {
          userId: user.uid,
          weight: parseFloat(weight),
          note,
          date: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, progressPath, auth);
      }

      // Update current profile
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, userPath), {
          currentWeight: parseFloat(weight),
          targetWeight: target ? parseFloat(target) : profile.targetWeight || 0,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath, auth);
      }

      setNote('');
      onSave();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <h3 className="text-xl font-bold text-slate-800 mb-6">ဝိတ်မှတ်တမ်းသွင်းရန်</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">လက်ရှိအလေးချိန် (kg)</label>
          <input 
            type="number" 
            step="0.1" 
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-lg"
            placeholder="ဥပမာ - ၇၀"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">ရည်မှန်းချက်အလေးချိန် (kg)</label>
          <input 
            type="number" 
            step="0.1" 
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            placeholder="ဥပမာ - ၆၀"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">မှတ်သားချင်တာများ</label>
          <textarea 
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            placeholder="ဒီနေ့ ဘာတွေထူးခြားလဲ..."
            rows={3}
          />
        </div>
        <button 
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'သိမ်းဆည်းနေသည်...' : 'သိမ်းဆည်းမည်'}
        </button>
      </form>
    </Card>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        // Initial profile fetch
        const userRef = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            // Create initial profile
            const newProfile = {
              uid: u.uid,
              displayName: u.displayName,
              email: u.email,
              photoURL: u.photoURL,
              createdAt: serverTimestamp()
            };
            try {
              await setDoc(userRef, newProfile);
              setProfile(newProfile as any);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`, auth);
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`, auth);
        }

        // Live progress subcollection
        const progressPath = `users/${u.uid}/progress`;
        const q = query(collection(db, progressPath), orderBy('date', 'desc'));
        onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProgressEntry));
          setProgress(data);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, progressPath, auth);
        });
      }
    });
    return unsubscribe;
  }, []);

  if (!authReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full space-y-8">
          <div className="space-y-4">
            <div className="mx-auto w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-emerald-200 transform rotate-12">
              <TrendingDown size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Weight Loss Tracker</h1>
            <p className="text-slate-600">ဝိတ်ချခြင်းနှင့် ကျန်းမာရေးအတွက် မြန်မာဘာသာဖြင့် အစအဆုံး အကူအညီပေးမည့် App</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-3xl font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google ဖြင့် စတင်မည်
          </button>
          
          <div className="pt-8 border-t border-slate-100 text-xs text-slate-400 space-y-1">
            <p>Dev BY KHAING MIN THANT</p>
            <p>Contact Admin: <a href="https://t.me/mgthantIT" className="text-emerald-600">https://t.me/mgthantIT</a></p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'ပင်မစာမျက်နှာ', icon: Home, component: <Dashboard profile={profile || {uid: user.uid} as any} progress={progress} /> },
    { id: 'tips', label: 'အကြံပြုချက်များ', icon: BookOpen, component: <TipsPage /> },
    { id: 'diet', label: 'အစားအသောက်', icon: Utensils, component: <DietPage /> },
    { id: 'exercise', label: 'လေ့ကျင့်ခန်းများ', icon: Dumbbell, component: <ExercisePage /> },
    { id: 'tracker', label: 'ဝိတ်မှတ်တမ်း', icon: LineChart, component: <TrackerPage user={user} profile={profile || {} as any} onSave={() => setActiveTab('dashboard')} /> },
  ];

  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || '';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans selection:bg-emerald-100">
      {/* Mobile Header */}
      <header className="lg:hidden h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <TrendingDown size={18} />
          </div>
          <h2 className="font-bold text-lg">{activeTabLabel}</h2>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600">
          <Menu size={24} />
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 lg:hidden"
            />
          )}
        </AnimatePresence>

        <aside className={cn(
          "fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 z-50 transform transition-transform duration-300 lg:translate-x-0 lg:static shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-emerald-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <TrendingDown size={24} />
              </div>
              <h1 className="font-black text-xl tracking-tight">Fitness MM</h1>
            </div>

            <nav className="flex-1 space-y-1">
              {tabs.map((tab) => (
                <SidebarItem 
                  key={tab.id}
                  icon={tab.icon}
                  label={tab.label}
                  active={activeTab === tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                />
              ))}
            </nav>

            <div className="mt-auto space-y-4 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-100">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Profile" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{user.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={logOut}
                className="flex items-center gap-3 w-full px-4 py-3 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
              >
                <LogOut size={20} />
                <span className="font-medium">ထွက်မည်</span>
              </button>
              
              <div className="px-2 pt-2 text-[10px] text-slate-400 font-medium">
                <p>Dev BY KHAING MIN THANT</p>
                <p>Contact: t.me/mgthantIT</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-12">
            <div className="hidden lg:flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{activeTabLabel}</h2>
                <p className="text-slate-500">ကျန်းမာသော ဘဝနေထိုင်မှုဆီသို့ အတူတူသွားကြစို့</p>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ယနေ့ရက်စွဲ</span>
                  <span className="text-sm font-bold text-slate-800">{format(new Date(), 'EEEE, MMM dd')}</span>
                </div>
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <TrendingDown size={20} />
                </div>
              </div>
            </div>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {tabs.find(t => t.id === activeTab)?.component}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
