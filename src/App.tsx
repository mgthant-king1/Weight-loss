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
  Info,
  Play,
  RotateCcw,
  Pause,
  Send,
  Timer
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

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn("bg-white border border-slate-100 rounded-3xl p-6 shadow-sm", className, onClick && "cursor-pointer active:scale-[0.98] transition-transform")}
  >
    {children}
  </div>
);

const ExerciseTimer = ({ exercise, onComplete, onCancel }: { exercise: any, onComplete: () => void, onCancel: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(exercise.durationSeconds);
  const [isActive, setIsActive] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev: number) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
      onComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    setTimeLeft(exercise.durationSeconds);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-6 text-center">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[3rem] p-8 max-w-sm w-full space-y-8 shadow-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {exercise.targetMuscleGroup}
            </span>
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
              exercise.difficultyLevel === 'Easy' ? "bg-emerald-50 text-emerald-600" :
              exercise.difficultyLevel === 'Medium' ? "bg-amber-50 text-amber-600" :
              "bg-rose-50 text-rose-600"
            )}>
              {exercise.difficultyLevel}
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900">{exercise.name}</h3>
          <p className="text-slate-500 text-sm">{exercise.description}</p>
        </div>

        <div className="relative w-48 h-48 mx-auto flex items-center justify-center font-mono text-5xl font-black text-emerald-600 bg-emerald-50 rounded-full border-8 border-emerald-100">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button onClick={reset} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors">
            <RotateCcw size={24} />
          </button>
          <button 
            onClick={toggle} 
            className={cn(
              "p-6 rounded-[2rem] text-white shadow-xl transition-all active:scale-95",
              isActive ? "bg-amber-500 shadow-amber-200" : "bg-emerald-600 shadow-emerald-200"
            )}
          >
            {isActive ? <Pause size={32} /> : <Play size={32} />}
          </button>
          <button onClick={onCancel} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        {timeLeft === 0 && (
          <p className="text-emerald-700 font-bold bg-emerald-50 py-3 rounded-2xl animate-pulse">
            ဂုဏ်ယူပါတယ်! လေ့ကျင့်ခန်းပြီးမြောက်ပါပြီ။
          </p>
        )}
      </motion.div>
    </div>
  );
};

// --- Pages ---

const Dashboard = ({ profile, progress, onSetTab }: { profile: UserProfile, progress: ProgressEntry[], onSetTab: (tab: string) => void }) => {
  const unit = profile.weightUnit || 'kg';
  
  const convert = (val: number) => {
    if (unit === 'lb') return val * 2.20462;
    return val;
  };

  const chartData = progress.map(p => ({
    date: format(p.date.toDate(), 'MMM dd'),
    weight: parseFloat(convert(p.weight).toFixed(1))
  })).reverse();

  const currentWeight = progress[0]?.weight || profile.currentWeight || 0;
  const targetWeight = profile.targetWeight || 0;
  const lost = profile.currentWeight ? profile.currentWeight - currentWeight : 0;
  const toGo = currentWeight - targetWeight;
  
  const setupRequired = !profile.currentWeight || !profile.targetWeight;

  return (
    <div className="space-y-6">
      {setupRequired ? (
        <Card className="bg-emerald-600 text-white border-none shadow-xl shadow-emerald-200">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Info size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-bold mb-1">အချက်အလက်များ လိုအပ်နေပါသည်</h3>
              <p className="text-emerald-100 text-sm">သင့်အတွက် ကိုက်ညီသော နည်းလမ်းများ ရရှိရန် သင်၏ အလေးချိန်များကို အရင်မှတ်သားပေးပါ။</p>
            </div>
            <button 
              onClick={() => onSetTab('tracker')}
              className="bg-white text-emerald-700 px-8 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-50 active:scale-95 transition-all"
            >
              စတင်သတ်မှတ်မည်
            </button>
          </div>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none shadow-xl shadow-emerald-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">သင့်အတွက် အကြံပြုချက်</h3>
              <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                {toGo > (unit === 'kg' ? 10 : 22) ? "Intensive Plan" : "Normal Plan"}
              </div>
            </div>
            <p className="text-emerald-50 leading-relaxed">
              {toGo > 0 
                ? `ရည်မှန်းချက်ပြည့်ဖို့ ${convert(toGo).toFixed(1)}${unit} လိုပါသေးတယ်။ ${toGo > (unit === 'kg' ? 10 : 22) ? "လေ့ကျင့်ခန်းကို ပိုတိုးလုပ်ပြီး အချိုလျှော့စားပေးပါ။" : "လမ်းမှန်ပေါ်ရောက်နေပါပြီ၊ ပုံမှန်လေး ဆက်လုပ်သွားပါ။"}`
                : "ဂုဏ်ယူပါတယ်! သင်ဟာ ရည်မှန်းချက်ကို ရောက်ရှိနေပါပြီ။ လက်ရှိဝိတ်ကို ထိန်းသိမ်းထားဖို့ ဆက်လက်ကြိုးစားပါ။"}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => onSetTab('tips')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">Tips ကြည့်မည်</button>
              <button onClick={() => onSetTab('diet')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">အစားအသောက်များ</button>
              <button onClick={() => onSetTab('exercise')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">လေ့ကျင့်ခန်းစမည်</button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">လက်ရှိဝိတ်</p>
              <p className="text-2xl font-black text-slate-900">{convert(currentWeight).toFixed(1)} {unit}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <LineChart size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">ရည်မှန်းချက်</p>
              <p className="text-2xl font-black text-slate-900">{convert(targetWeight).toFixed(1)} {unit}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <Info size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">ကျဆင်းမှု</p>
              <p className="text-2xl font-black text-slate-900">{convert(lost).toFixed(1)} {unit}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="h-80">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-slate-800">တိုးတက်မှုပြဇယား ({unit})</h3>
          <button onClick={() => onSetTab('tracker')} className="text-emerald-600 text-xs font-bold hover:underline">အားလုံးကြည့်မည်</button>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
              <Tooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="#059669" 
                strokeWidth={4} 
                dot={{r: 6, fill: '#059669', strokeWidth: 3, stroke: '#fff'}} 
                activeDot={{r: 8, strokeWidth: 0}}
              />
            </ReLineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
              <LineChart size={24} />
            </div>
            <p className="text-sm font-medium">မှတ်တမ်းများ မရှိသေးပါ။</p>
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

const ExercisePage = () => {
  const [selectedExercise, setSelectedExercise] = useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {EXERCISES.map((ex, i) => (
          <Card key={i} className="overflow-hidden p-0 group">
            <div className="aspect-video bg-emerald-100 relative">
              <img 
                src={`https://picsum.photos/seed/${ex.name}/600/400?grayscale`} 
                alt={ex.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-emerald-700 shadow-sm">
                {ex.duration}
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase">
                  {ex.targetMuscleGroup}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                  ex.difficultyLevel === 'Easy' ? "bg-emerald-50 text-emerald-600" :
                  ex.difficultyLevel === 'Medium' ? "bg-amber-50 text-amber-600" :
                  "bg-rose-50 text-rose-600"
                )}>
                  {ex.difficultyLevel}
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-800 mb-2">{ex.name}</h4>
              <p className="text-slate-600 text-sm mb-4">{ex.description}</p>
              <button 
                onClick={() => setSelectedExercise(ex)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <Timer size={16} />
                စတင်လုပ်ဆောင်မည်
              </button>
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {selectedExercise && (
          <ExerciseTimer 
            exercise={selectedExercise} 
            onComplete={() => {}} 
            onCancel={() => setSelectedExercise(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TrackerPage = ({ user, profile, progress, onSave }: { user: User, profile: UserProfile, progress: ProgressEntry[], onSave: () => void }) => {
  const [unit, setUnit] = useState<'kg' | 'lb'>(profile.weightUnit || 'kg');
  
  const convert = (val: number) => {
    if (unit === 'lb') return (val * 2.20462).toFixed(1);
    return val.toFixed(1);
  };

  const displayVal = (kg: number) => {
    if (unit === 'lb') return (kg * 2.20462).toFixed(1);
    return kg.toString();
  };

  const toKg = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    if (unit === 'lb') return num / 2.20462;
    return num;
  };

  const [weight, setWeight] = useState(profile.currentWeight ? displayVal(profile.currentWeight) : '');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState(profile.targetWeight ? displayVal(profile.targetWeight) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    const weightInKg = toKg(weight);
    const targetInKg = target ? toKg(target) : profile.targetWeight || 0;

    try {
      // Create progress entry
      const progressPath = `users/${user.uid}/progress`;
      try {
        await addDoc(collection(db, progressPath), {
          userId: user.uid,
          weight: weightInKg,
          note,
          date: serverTimestamp()
        });
      } catch (err: any) {
        console.error("Progress add error:", err);
        throw err;
      }

      // Update current profile
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, userPath), {
          currentWeight: weightInKg,
          targetWeight: targetInKg,
          weightUnit: unit,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err: any) {
        console.error("Profile update error:", err);
        throw err;
      }

      setNote('');
      setSuccess(true);
      setTimeout(() => {
        onSave();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "အချက်အလက် သိမ်းဆည်း၍ မရပါ။ Firebase တွင် Firestore Database ကို Enable လုပ်ထားခြင်း ရှိမရှိ နှင့် Rules များကို စစ်ဆေးပေးပါ။");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <Card className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-800">ဝိတ်မှတ်တမ်းသွင်းရန်</h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setUnit('kg')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", unit === 'kg' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500")}
            >
              KG
            </button>
            <button 
              onClick={() => setUnit('lb')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", unit === 'lb' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500")}
            >
              LB
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs flex items-start gap-2 border border-rose-100 animate-shake">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-emerald-50 text-emerald-600 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-emerald-100">
            <TrendingDown size={18} />
            <p>မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">လက်ရှိအလေးချိန် ({unit})</label>
            <input 
              type="number" 
              step="0.1" 
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-lg"
              placeholder={`ဥပမာ - ${unit === 'kg' ? '၇၀' : '၁၅၀'}`}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ရည်မှန်းချက်အလေးချိန် ({unit})</label>
            <input 
              type="number" 
              step="0.1" 
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              placeholder={`ဥပမာ - ${unit === 'kg' ? '၆၀' : '၁၃၀'}`}
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

      <div className="max-w-md mx-auto space-y-4">
        <h4 className="font-bold text-slate-800 px-2">မှတ်တမ်းဟောင်းများ</h4>
        {progress.length > 0 ? (
          progress.map((p, i) => (
            <Card key={i} className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase">{format(p.date.toDate(), 'PPP')}</span>
                <span className="text-slate-600 text-sm italic">{p.note || 'မှတ်ချက်မရှိပါ'}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-slate-900">{convert(p.weight)}</span>
                <span className="ml-1 text-xs font-bold text-slate-500 uppercase">{unit}</span>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-center text-slate-400 text-sm py-10">မှတ်တမ်းများ မရှိသေးပါ။</p>
        )}
      </div>
    </div>
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
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await signInWithGoogle();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
      console.error(err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        // Live profile fetch
        const userRef = doc(db, 'users', u.uid);
        const unsubProfile = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            setDoc(userRef, {
              uid: u.uid,
              displayName: u.displayName,
              email: u.email,
              photoURL: u.photoURL,
              createdAt: serverTimestamp()
            }, { merge: true }).catch(e => console.error("Auto profile creation failed", e));
          }
        }, (err) => {
          console.error("Profile sync error", err);
          if (err.message.includes("permission-denied")) {
            setLoginError("Firebase Firestore Rules ခွင့်ပြုချက်မရှိပါ။ (Missing or insufficient permissions)");
          }
        });

        // Live progress subcollection
        const progressPath = `users/${u.uid}/progress`;
        const q = query(collection(db, progressPath), orderBy('date', 'desc'));
        const unsubProgress = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProgressEntry));
          setProgress(data);
        }, (err) => {
          console.error("Progress sync error", err);
        });

        return () => {
          unsubProfile();
          unsubProgress();
        };
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
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-3xl font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google ဖြင့် စတင်မည်
          </button>

          <a 
            href="https://t.me/mgthantIT" 
            target="_blank" 
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-3 bg-[#24A1DE] text-white py-4 rounded-3xl font-bold shadow-lg shadow-sky-100 hover:bg-[#208dc2] active:scale-95 transition-all"
          >
            <Send size={20} fill="white" />
            Telegram ဖြင့် ဆက်သွယ်ရန်
          </a>

          {loginError && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs text-left overflow-auto max-h-32 border border-rose-100">
              <p className="font-bold mb-1">Error:</p>
              <p>{loginError}</p>
              <p className="mt-2 text-[10px] text-rose-400 font-normal">
                * အကယ်၍ Vercel တွင်သုံးနေပါက Firebase Console တွင် Domain ကို Authorize လုပ်ပေးရန်လိုအပ်ပါသည်။
              </p>
            </div>
          )}
          
          <div className="pt-8 border-t border-slate-100 text-xs text-slate-400 space-y-1">
            <p>Dev BY KHAING MIN THANT</p>
            <p>Contact Admin: <a href="https://t.me/mgthantIT" className="text-emerald-600">https://t.me/mgthantIT</a></p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'ပင်မစာမျက်နှာ', icon: Home, component: <Dashboard profile={profile || {uid: user.uid} as any} progress={progress} onSetTab={setActiveTab} /> },
    { id: 'tips', label: 'အကြံပြုချက်များ', icon: BookOpen, component: <TipsPage /> },
    { id: 'diet', label: 'အစားအသောက်', icon: Utensils, component: <DietPage /> },
    { id: 'exercise', label: 'လေ့ကျင့်ခန်းများ', icon: Dumbbell, component: <ExercisePage /> },
    { id: 'tracker', label: 'ဝိတ်မှတ်တမ်း', icon: LineChart, component: <TrackerPage user={user} profile={profile || {} as any} progress={progress} onSave={() => setActiveTab('dashboard')} /> },
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
                <a href="https://t.me/mgthantIT" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-emerald-600 transition-colors mb-2">
                  <Send size={12} fill="currentColor" />
                  <span>Telegram Join</span>
                </a>
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
