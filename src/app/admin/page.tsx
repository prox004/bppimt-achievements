"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Download, Search, LogOut, FileText, Loader2 } from "lucide-react";

interface Student {
    userId: string;
    fullName: string;
    email: string;
    rollNumber: string;
    department: string;
    currentYear: string;
}

interface Achievement {
    id: string;
    userId: string;
    academicYear: string;
    type: string;
    eventName: string;
    date: string;
    certificateUrl: string;
    position?: string;
}

interface CombinedRow extends Student, Achievement { }

export default function AdminDashboard() {
    const { user, role, loading, signOut } = useAuth();
    const router = useRouter();

    const [rows, setRows] = useState<CombinedRow[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    const [search, setSearch] = useState("");
    const [filterCurrentYear, setFilterCurrentYear] = useState("");
    const [filterAchYear, setFilterAchYear] = useState("");
    const [filterDept, setFilterDept] = useState("");
    const [filterType, setFilterType] = useState("");

    useEffect(() => {
        if (!loading) {
            if (!user || role !== "admin") {
                router.push("/");
            } else {
                fetchData();
            }
        }
    }, [user, role, loading, router]);

    const fetchData = async () => {
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            const combined: CombinedRow[] = [];

            const promises = usersSnap.docs.map(async (userDoc) => {
                const student = userDoc.data() as Student;
                const certsSnap = await getDocs(collection(db, "users", userDoc.id, "certificates"));

                certsSnap.forEach((certDoc) => {
                    combined.push({
                        ...student,
                        ...(certDoc.data() as Omit<Achievement, "userId" | "id">),
                        userId: userDoc.id,
                        id: certDoc.id
                    } as CombinedRow);
                });
            });

            await Promise.all(promises);

            // Sort by date desc
            combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRows(combined);
        } catch (err) {
            console.error("Error fetching admin data:", err);
        } finally {
            setIsFetching(false);
        }
    };

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            const matchSearch = row.fullName.toLowerCase().includes(search.toLowerCase()) ||
                row.email.toLowerCase().includes(search.toLowerCase());
            const matchCurrentYear = filterCurrentYear ? row.currentYear === filterCurrentYear : true;
            const matchAchYear = filterAchYear ? row.academicYear === filterAchYear : true;
            const matchDept = filterDept ? row.department === filterDept : true;
            const matchType = filterType ? row.type === filterType : true;

            return matchSearch && matchCurrentYear && matchAchYear && matchDept && matchType;
        });
    }, [rows, search, filterCurrentYear, filterAchYear, filterDept, filterType]);

    const exportCSV = () => {
        const headers = ["Name,Email,Roll Number,Department,Current Year,Achievement Year,Type,Event,Position,Date,Certificate URL"];
        const csvRows = filteredRows.map(row =>
            `"${row.fullName}","${row.email}","${row.rollNumber}","${row.department}","${row.currentYear}","${row.academicYear}","${row.type}","${row.eventName}","${row.position || ''}","${row.date}","${row.certificateUrl}"`
        );
        const csvContent = headers.concat(csvRows).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "achievements.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading || isFetching) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    // Calculate some basic stats
    const totalSubmissions = filteredRows.length;
    const deptStats = filteredRows.reduce((acc, row) => {
        acc[row.department] = (acc[row.department] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8 shrink-0">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-xl text-gray-900">Admin Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full hidden sm:block">Admin</span>
                        <button onClick={signOut} className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">

                {/* Analytics row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-sm font-medium text-gray-500">Total Filtered</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{totalSubmissions}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-3 flex overflow-x-auto gap-6 items-center">
                        {Object.entries(deptStats).map(([dept, count]) => (
                            <div key={dept} className="flex flex-col">
                                <span className="text-sm text-gray-500">{dept}</span>
                                <span className="text-xl font-bold text-gray-900">{count}</span>
                            </div>
                        ))}
                        {Object.keys(deptStats).length === 0 && <span className="text-sm text-gray-500">No departments match current filters.</span>}
                    </div>
                </div>

                {/* Filters and Actions */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-center">
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 w-full xl:w-auto">
                        <div className="relative col-span-2 sm:col-span-1 w-full sm:w-auto">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-primary focus:border-primary w-full sm:w-48"
                            />
                        </div>

                        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-primary focus:border-primary bg-white w-full sm:w-auto">
                            <option value="">All Depts</option>
                            <option value="CSE">CSE</option>
                            <option value="IT">IT</option>
                            <option value="ECE">ECE</option>
                            <option value="EE">EE</option>
                            <option value="BCA">BCA</option>
                            <option value="MCA">MCA</option>
                        </select>

                        <select value={filterCurrentYear} onChange={e => setFilterCurrentYear(e.target.value)} className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-primary focus:border-primary bg-white w-full sm:w-auto">
                            <option value="">Current Yr</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="Passout">Passout</option>
                        </select>

                        <select value={filterAchYear} onChange={e => setFilterAchYear(e.target.value)} className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-primary focus:border-primary bg-white w-full sm:w-auto">
                            <option value="">Achieved Yr</option>
                            <option value="2022-23">2022-23</option>
                            <option value="2023-24">2023-24</option>
                            <option value="2024-25">2024-25</option>
                            <option value="2025-26">2025-26</option>
                        </select>

                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-primary focus:border-primary bg-white w-full sm:w-auto">
                            <option value="">All Types</option>
                            <option value="Technical">Technical</option>
                            <option value="Cultural">Cultural</option>
                            <option value="Sports">Sports</option>
                            <option value="Others">Others</option>
                        </select>
                    </div>

                    <button onClick={exportCSV} className="w-full xl:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {["Name", "Roll", "Dept", "Current Year", "Achieved Year", "Type", "Event", "Position", "Date", "Certificate"].map((h) => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{row.fullName}</div>
                                            <div className="text-sm text-gray-500">{row.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.rollNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{row.department}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currentYear}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{row.academicYear}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.eventName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.position || "-"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(row.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <a href={row.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 font-medium inline-flex items-center">
                                                View
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-500">
                                            No achievements found matching your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
