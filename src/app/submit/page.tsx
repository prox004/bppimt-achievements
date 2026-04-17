"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, setDoc, getDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, Upload, FileText, CheckCircle2, LogOut, Loader2, History, ChevronLeft, ChevronRight } from "lucide-react";

interface Achievement {
    id: string;
    academicYear: string;
    type: string;
    eventName: string;
    date: string;
    file: File | null;
    position?: string;
}

interface PastAchievement {
    id: string;
    academicYear: string;
    type: string;
    eventName: string;
    date: string;
    certificateUrl: string;
    createdAt: string;
    position?: string;
}

const DEPARTMENTS = ["CSE", "IT", "ECE", "EE", "BCA", "MCA"];
const CURRENT_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Passout"];
const ACADEMIC_YEARS = ["2022-23", "2023-24", "2024-25", "2025-26"];
const ACHIEVEMENT_TYPES = ["Technical", "Cultural", "Sports", "Others"];

export default function SubmitPage() {
    const { user, role, loading, signOut } = useAuth();
    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [department, setDepartment] = useState("");
    const [currentYear, setCurrentYear] = useState("");

    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [previousAchievements, setPreviousAchievements] = useState<PastAchievement[]>([]);

    const carouselRef = useRef<HTMLDivElement>(null);

    const [isFetchingHistory, setIsFetchingHistory] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/");
            } else if (role === "admin") {
                router.push("/admin");
            } else {
                fetchHistory();
            }
        }
    }, [user, role, loading, router]);

    const fetchHistory = async () => {
        if (!user) return;
        try {
            // Fetch student profile to prefill
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                const latestProfile = userSnap.data();

                setFullName(latestProfile.fullName || "");
                setRollNumber(latestProfile.rollNumber || "");
                setDepartment(latestProfile.department || "");
                setCurrentYear(latestProfile.currentYear || "");
            }

            // Fetch previous achievements subcollection
            const achSnaps = await getDocs(collection(db, "users", user.uid, "certificates"));
            const past: PastAchievement[] = [];
            achSnaps.forEach(doc => {
                past.push({ id: doc.id, ...doc.data() } as PastAchievement);
            });
            // Sort locally: newest first
            past.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
            setPreviousAchievements(past);

        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const scrollCarousel = (direction: "left" | "right") => {
        if (carouselRef.current) {
            const scrollAmount = 320;
            carouselRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
        }
    };

    const addAchievement = () => {
        setAchievements([
            ...achievements,
            { id: uuidv4(), academicYear: "", type: "", eventName: "", date: "", file: null, position: "" }
        ]);
    };

    const removeAchievement = (id: string) => {
        setAchievements(achievements.filter((a) => a.id !== id));
    };

    const updateAchievement = (id: string, field: keyof Achievement, value: any) => {
        setAchievements(achievements.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Basic validation
        if (!fullName || !rollNumber || !department || !currentYear || achievements.length === 0) {
            alert("Please fill all required details and add at least one achievement.");
            return;
        }

        const uncompletedAchievements = achievements.filter(
            a => !a.academicYear || !a.type || !a.eventName || !a.date || !a.file
        );

        if (uncompletedAchievements.length > 0) {
            alert("Please complete all achievement details including file uploads.");
            return;
        }

        // Extremely restrictive 2MB File check 
        const oversizedFiles = achievements.filter(a => a.file && a.file.size > 2 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            alert("One or more files exceed the 2MB limit. Please compress your files to under 2MB before uploading!");
            return;
        }

        setIsSubmitting(true);
        setUploadProgress("Initializing Profile...");
        try {
            // Create or merge user document at root
            await setDoc(doc(db, "users", user.uid), {
                userId: user.uid,
                email: user.email,
                fullName,
                rollNumber,
                department,
                currentYear,
                lastUpdatedAt: new Date().toISOString()
            }, { merge: true });

            let current = 1;

            // Upload files and create achievements
            for (const ach of achievements) {
                setUploadProgress(`Securing connection for certificate ${current}...`);

                // 1. Get Signature payload
                const signRes = await fetch("/api/sign-cloudinary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folder: `Certificates/${fullName.replace(/[^a-zA-Z0-9 ]/g, "").trim()}` })
                });
                
                if (!signRes.ok) throw new Error("Failed to secure Cloudinary transmission");
                const signData = await signRes.json();

                setUploadProgress(`Uploading certificate ${current} of ${achievements.length}...`);

                // 2. Direct client upload to Cloudinary (Bypass Vercel 4.5MB limitation completely)
                const cloudFormData = new FormData();
                cloudFormData.append("file", ach.file!);
                cloudFormData.append("api_key", signData.apiKey);
                cloudFormData.append("timestamp", signData.timestamp.toString());
                cloudFormData.append("signature", signData.signature);
                cloudFormData.append("folder", `Certificates/${fullName.replace(/[^a-zA-Z0-9 ]/g, "").trim()}`);
                
                const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`, {
                    method: "POST",
                    body: cloudFormData
                });
                
                const cloudData = await cloudRes.json();
                if (!cloudRes.ok) {
                    throw new Error(cloudData.error?.message || "Failed to upload file to Cloudinary");
                }

                const fileUrl = cloudData.secure_url;

                setUploadProgress(`Registering certificate ${current}...`);

                // 3. Save purely the URL payload to Google Sheets route
                const formData = new FormData();
                formData.append("fileUrl", fileUrl);
                formData.append("userId", user.uid);
                formData.append("fullName", fullName);
                formData.append("email", user.email || "");
                formData.append("rollNumber", rollNumber);
                formData.append("department", department);
                formData.append("currentYear", currentYear);
                formData.append("academicYear", ach.academicYear);
                formData.append("type", ach.type);
                formData.append("eventName", ach.eventName);
                formData.append("date", ach.date);
                if (ach.position) formData.append("position", ach.position);

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                const uploadData = await uploadRes.json();

                if (!uploadRes.ok) {
                    throw new Error(`Server Error: ${uploadData.error || uploadData.message || "Failed to log to Google Sheets"}`);
                }

                // 4. Save to Firebase subcollection
                await addDoc(collection(db, "users", user.uid, "certificates"), {
                    academicYear: ach.academicYear,
                    type: ach.type,
                    eventName: ach.eventName,
                    date: ach.date,
                    certificateUrl: fileUrl,
                    createdAt: new Date().toISOString(),
                    position: ach.position || ""
                });

                current++;
            }

            setUploadProgress("Finalizing Records...");
            setSubmitted(true);
        } catch (error: any) {
            console.error("Submission error:", error);
            alert(`Failed to submit: ${error.message || "Unknown error"}. Please try again.`);
        } finally {
            setIsSubmitting(false);
            setUploadProgress("");
        }
    };

    if (loading || isFetchingHistory || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Successfully Submitted!</h2>
                    <p className="text-gray-500">Your achievements have been recorded successfully.</p>

                    <button onClick={() => { setSubmitted(false); setAchievements([]); fetchHistory(); }} className="mt-4 w-full py-2 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                        Submit More Certificates
                    </button>
                    <button onClick={signOut} className="mt-2 w-full py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <nav className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-bold text-xl text-gray-900">Submission Portal</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
                        <button onClick={signOut} className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">


                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Basic Details */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                        <div className="border-b border-gray-100 pb-4 mb-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Basic Details</h2>
                                <p className="text-sm text-gray-500">Auto-filled from your previous submission</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name<span className="text-red-500 ml-1">*</span></label>
                                <input required type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input required type="email" value={user.email || ""} disabled className="mt-1 block w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg shadow-sm sm:text-sm cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Roll Number<span className="text-red-500 ml-1">*</span></label>
                                <input required type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department<span className="text-red-500 ml-1">*</span></label>
                                    <select required value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm bg-white">
                                        <option value="" disabled>Select</option>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Current Year<span className="text-red-500 ml-1">*</span></label>
                                    <select required value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm bg-white">
                                        <option value="" disabled>Select</option>
                                        {CURRENT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Achievements Section */}
                    <section className="space-y-6">
                        <div className="flex justify-between items-end border-b border-gray-200 pb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">New Achievements</h2>
                                <p className="text-sm text-gray-500">Provide certificates and the academic year they were achieved in.</p>
                            </div>
                            <button type="button" onClick={addAchievement} className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                                <Plus className="w-4 h-4 mr-2" /> Add
                            </button>
                        </div>

                        {achievements.length === 0 && (
                            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                                <p className="text-gray-500 text-sm">You haven't queued any new achievements for this session. Click "Add".</p>
                            </div>
                        )}

                        {achievements.map((ach, index) => (
                            <div key={ach.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group transition-all">
                                <button type="button" onClick={() => removeAchievement(ach.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <h3 className="font-medium text-gray-900 mb-4 pr-12">New Queue #{index + 1}</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Achieved Year<span className="text-red-500 ml-1">*</span></label>
                                        <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Session when this was awarded</p>
                                        <select required value={ach.academicYear} onChange={(e) => updateAchievement(ach.id, "academicYear", e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm bg-white">
                                            <option value="" disabled>Select Year</option>
                                            {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Type<span className="text-red-500 ml-1">*</span></label>
                                        <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Category of the achievement</p>
                                        <select required value={ach.type} onChange={(e) => updateAchievement(ach.id, "type", e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm bg-white">
                                            <option value="" disabled>Select Type</option>
                                            {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Event Name<span className="text-red-500 ml-1">*</span></label>
                                        <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Full name of the competition or event</p>
                                        <input required type="text" value={ach.eventName} onChange={(e) => updateAchievement(ach.id, "eventName", e.target.value)} placeholder="e.g. Hackathon 2023" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Position / Rank</label>
                                        <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Optional (e.g., 1st Prize, Finalist)</p>
                                        <input type="text" value={ach.position || ""} onChange={(e) => updateAchievement(ach.id, "position", e.target.value)} placeholder="e.g. 1st Prize" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Date<span className="text-red-500 ml-1">*</span></label>
                                        <p className="text-[10px] text-gray-500 mt-0.5 mb-1">When it was held or awarded</p>
                                        <input required type="date" value={ach.date} onChange={(e) => updateAchievement(ach.id, "date", e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Certificate<span className="text-red-500 ml-1">*</span></label>
                                        <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Upload valid proof (PDF / Image)</p>
                                        <div className="mt-1 flex items-center">
                                            <div className="relative border border-gray-300 border-dashed rounded-lg px-2 py-2 flex justify-center w-full hover:bg-gray-50 transition-colors overflow-hidden">
                                                <div className="text-center w-full flex items-center justify-center gap-2">
                                                    <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                                                    <span className="text-xs text-gray-600 truncate max-w-[80px] sm:max-w-[120px]">
                                                        {ach.file ? ach.file.name : "Upload"}
                                                    </span>
                                                </div>
                                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" required={!ach.file} onChange={(e) => updateAchievement(ach.id, "file", e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    <div className="flex justify-end pt-6 border-t border-gray-200">
                        <button type="submit" disabled={isSubmitting || achievements.length === 0} className="inline-flex justify-center py-3 px-8 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed items-center">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {isSubmitting ? (uploadProgress || "Submitting...") : "Submit Achievements"}
                        </button>
                    </div>

                </form>

                {/* Previous Submissions Carousel Display */}
                {previousAchievements.length > 0 && (
                    <section className="mt-12 pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-6 px-1">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-gray-400" />
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Past Certificates</h2>
                                    <p className="text-sm text-gray-500">Swipe to view your prior historical uploads</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Navigation Arrows */}
                                <div className="hidden sm:flex items-center gap-2 mr-2">
                                    <button onClick={() => scrollCarousel('left')} type="button" className="p-2 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => scrollCarousel('right')} type="button" className="p-2 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">{previousAchievements.length} Total</span>
                            </div>
                        </div>

                        <div ref={carouselRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1 relative">
                            {previousAchievements.map((ach) => (
                                <div key={ach.id} className="min-w-[280px] sm:min-w-[320px] snap-start border border-gray-200 rounded-xl p-5 flex flex-col justify-between bg-white shadow-sm hover:shadow-md transition-all duration-200 shrink-0">
                                    <div>
                                        <div className="flex justify-between items-start gap-3">
                                            <h3 className="font-semibold text-gray-900 line-clamp-2">{ach.eventName}</h3>
                                            <span className="text-[10px] font-bold tracking-widest uppercase bg-primary/10 text-primary px-2 py-1 rounded shrink-0">{ach.academicYear}</span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                            <span className="font-medium bg-gray-100 px-2 py-1 rounded">{ach.type}</span>
                                            <span>{new Date(ach.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="mt-5 border-t border-gray-100 pt-3">
                                        <a href={ach.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center group w-fit">
                                            View Certificate
                                            <span className="ml-1 group-hover:translate-x-1 transition-transform">&rarr;</span>
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
