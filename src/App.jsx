import React, { useEffect, useState, useMemo } from "react";
import emailjs from "emailjs-com";
import "./index.css";

// Utility helpers
const uid = () => Math.random().toString(36).slice(2, 9);
const nowStr = () => new Date().toLocaleString();

// Local Storage helpers
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

export default function App() {
  const [user, setUser] = useState(() => load("ms_user", null));
  const [flash, setFlash] = useState(null);

  // To-Do List state for session
  const [lowStockOrderSent, setLowStockOrderSent] = useState(() => load("ms_lowStockOrderSent", []));
  const [contactedPatients, setContactedPatients] = useState(() => load("ms_contactedPatients", []));

  useEffect(() => save("ms_lowStockOrderSent", lowStockOrderSent), [lowStockOrderSent]);
  useEffect(() => save("ms_contactedPatients", contactedPatients), [contactedPatients]);

  // Helper to show flash and then show expiry/low stock after
  const showFlash = (msg, type = "success") => {
    setFlash({ type, msg });
    setTimeout(() => {
      showExpiryLowStockFlash();
    }, 3500);
  };

  // Always show expiry/low stock flash if present and no other flash
  const showExpiryLowStockFlash = () => {
    if (!user) return;
    const now = new Date();
    const monthAhead = new Date();
    monthAhead.setMonth(now.getMonth() + 1);
    const expiryWithinMonth = medicines.filter(
      (m) => m.expiry && new Date(m.expiry) <= monthAhead && new Date(m.expiry) >= now
    );
    const lowStock = medicines.filter((m) => Number(m.stock) < 20 && !lowStockOrderSent.includes(m.id));
    const combinedMessages = [];
    if (expiryWithinMonth.length) combinedMessages.push(`⚠ ${expiryWithinMonth.length} medicine(s) expiring soon.`);
    if (lowStock.length) combinedMessages.push(`⚠ ${lowStock.length} medicine(s) low in stock.`);
    if (combinedMessages.length) {
      setFlash({ type: "error", msg: combinedMessages.join(" ") });
    }
  };

  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => {
        setFlash(null);
        showExpiryLowStockFlash();
      }, 3500);
      return () => clearTimeout(t);
    } else {
      showExpiryLowStockFlash();
    }
    // eslint-disable-next-line
  }, [flash, user]);

  const [suppliers, setSuppliers] = useState(() => load("ms_suppliers", []));
  const [medicines, setMedicines] = useState(() => load("ms_medicines", []));
  const [orders, setOrders] = useState(() => load("ms_orders", []));
  const [posts, setPosts] = useState(() => load("ms_posts", []));
  const [patients, setPatients] = useState(() => load("ms_patients", []));

  useEffect(() => save("ms_suppliers", suppliers), [suppliers]);
  useEffect(() => save("ms_medicines", medicines), [medicines]);
  useEffect(() => save("ms_orders", orders), [orders]);
  useEffect(() => save("ms_posts", posts), [posts]);
  useEffect(() => save("ms_patients", patients), [patients]);

  const [view, setView] = useState("dashboard");
  const [supplierForm, setSupplierForm] = useState({ id: "", name: "", email: "", phone: "" });
  const [supplierSearch, setSupplierSearch] = useState("");
  const [orderForm, setOrderForm] = useState({ id: "", email: "", items: [] });
  const [medicineForm, setMedicineForm] = useState({ id: "", name: "", row: "", slot: "", stock: 0, expiry: "" });
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState(null);

  // Patient state (extended)
  const [patientForm, setPatientForm] = useState({
    id: "",
    name: "",
    age: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    disease: "",
    medicineType: "",
    medicineExpiry: "",
    editMode: false,
  });
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const addPost = (desc) => {
    const p = { id: uid(), desc, ts: nowStr() };
    setPosts((s) => [p, ...s]);
  };

  const handleLogin = (username, password) => {
    if (username === "test" && password === "test") {
      const u = { username: "test", loginAt: new Date().toISOString() };
      setUser(u);
      save("ms_user", u);
      showFlash("Login successful", "success");
      setView("dashboard");
    } else {
      showFlash("Invalid credentials", "error");
    }
  };
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("ms_user");
    setView("login");
    showFlash("Logged out", "success");
  };

  // --- Patient CRUD (extended) ---
  const savePatient = () => {
    const { id, name, age, gender, phone, email, address, disease, medicineType, medicineExpiry, editMode } = patientForm;
    if (
      !name.trim() ||
      !age.trim() ||
      !gender.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !address.trim() ||
      !disease.trim() ||
      !medicineType.trim() ||
      !medicineExpiry.trim()
    ) {
      showFlash("⚠️ All fields are required!", "error");
      return;
    }
    if (!/^\d+$/.test(age) || Number(age) <= 0) {
      showFlash("⚠️ Age must be a positive number!", "error");
      return;
    }
    if (editMode) {
      setPatients((arr) =>
        arr.map((p) =>
          p.id === id
            ? { id, name, age, gender, phone, email, address, disease, medicineType, medicineExpiry }
            : p
        )
      );
      addPost(`Updated patient ${name}`);
      showFlash("✅ Patient updated successfully!", "success");
    } else {
      // Prevent duplicate phone/email
      if (patients.some((p) => p.phone === phone)) {
        showFlash("⚠️ Phone number already exists!", "error");
        return;
      }
      if (patients.some((p) => p.email === email)) {
        showFlash("⚠️ Email already exists!", "error");
        return;
      }
      setPatients((arr) => [
        {
          id: uid(),
          name,
          age,
          gender,
          phone,
          email,
          address,
          disease,
          medicineType,
          medicineExpiry,
        },
        ...arr,
      ]);
      addPost(`Added patient ${name}`);
      showFlash("✅ Patient added successfully!", "success");
    }
    setPatientForm({
      id: "",
      name: "",
      age: "",
      gender: "",
      phone: "",
      email: "",
      address: "",
      disease: "",
      medicineType: "",
      medicineExpiry: "",
      editMode: false,
    });
    setShowPatientForm(false);
  };

  const editPatient = (p) => {
    setPatientForm({ ...p, editMode: true });
    setShowPatientForm(true);
  };

  const deletePatient = (id) => {
    const p = patients.find((x) => x.id === id);
    if (p && window.confirm(`Delete patient ${p.name}?`)) {
      setPatients((arr) => arr.filter((x) => x.id !== id));
      addPost(`Deleted patient ${p.name}`);
      showFlash("Patient deleted", "success");
    }
  };

  // --- Expiry Alert for Patients ---
  const patientsWithExpiringMedicine = useMemo(() => {
    const now = new Date();
    const monthAhead = new Date();
    monthAhead.setMonth(now.getMonth() + 1);
    return patients.filter(
      (p) =>
        p.medicineExpiry &&
        new Date(p.medicineExpiry) <= monthAhead &&
        new Date(p.medicineExpiry) >= now &&
        !contactedPatients.includes(p.id)
    );
  }, [patients, contactedPatients]);

  // --- Expired Medicines ---
  const expiredMedicines = useMemo(() => {
    const now = new Date();
    return medicines.filter((m) => m.expiry && new Date(m.expiry) < now);
  }, [medicines]);

  // --- Low Stock Medicines (not ordered yet) ---
  const lowStockMedicines = useMemo(() => {
    return medicines.filter((m) => Number(m.stock) < 20 && !expiredMedicines.some(e => e.id === m.id) && !lowStockOrderSent.includes(m.id));
  }, [medicines, expiredMedicines, lowStockOrderSent]);

  // --- Dashboard: Patients with expiring medicine ---
  const dashboardPatientsWithExpiringMedicine = patientsWithExpiringMedicine;

  // --- Low Stock Highlighted in Pharmacy Table ---
  const isLowStockOrdered = (id) => lowStockOrderSent.includes(id);
const saveSupplier = () => {
    const { id, name, email, phone } = supplierForm;
    if (!name.trim()) return showFlash("Supplier name required", "error");
    if (id) {
      setSuppliers((s) => s.map((it) => (it.id === id ? { ...it, name, email, phone } : it)));
      addPost(`Updated supplier ${name}`);
      showFlash("Supplier updated", "success");
    } else {
      const newS = { id: uid(), name, email, phone };
      setSuppliers((s) => [newS, ...s]);
      addPost(`Added supplier ${name}`);
      showFlash("Supplier added", "success");
    }
    setSupplierForm({ id: "", name: "", email: "", phone: "" });
  };
  const editSupplier = (id) => {
    const s = suppliers.find((x) => x.id === id);
    if (s) setSupplierForm(s);
  };
  const deleteSupplier = (id) => {
    const s = suppliers.find((x) => x.id === id);
    if (s && window.confirm(`Delete supplier ${s.name}?`)) {
      setSuppliers((arr) => arr.filter((x) => x.id !== id));
      addPost(`Deleted supplier ${s.name}`);
      showFlash("Supplier deleted", "success");
    }
  };

  // --- Updated sendOrder to accept order object for multi-medicine orders ---
  const sendOrder = (orderObj) => {
    const { id, medicine, quantity, email } = orderObj;

    // Basic validation (already done in UI, but keep for safety)
    if (!id.trim() || !medicine.trim() || !email.trim() || quantity <= 0) {
      showFlash("⚠️ Please complete the order form.", "error");
      return;
    }

    setOrders((o) => [orderObj, ...o]);
    addPost(`📦 Order sent for ${medicine} (qty ${quantity}) to ${email}`);
    showFlash(`✅ Order sent to ${email}!`, "success");

    // ✉️ Send Email using EmailJS
    emailjs.send(
      "service_io3tkqd",
      "template_skivkoq",
      {
        to_email: email,
        medicine_name: medicine,
        quantity: quantity,
      },
      "AmFsEYcX6OfaTNILe"
    )
      .then(() => {
        console.log(`✅ Email successfully sent to ${email}`);
      })
      .catch((error) => {
        console.error("❌ Email sending failed:", error);
        showFlash("Email sending failed. Please try again.", "error");
      });
  };

  // Save medicine (add or edit)
  const saveMedicine = () => {
    const { name, row, slot, stock, expiry, editMode } = medicineForm;

    // Validation
    if (!name || !row || !slot || !expiry || stock === "" || Number.isNaN(stock)) {
      showFlash("⚠️ All fields are required and must be valid.", "error");
      return;
    }
    if (Number(stock) < 0) {
      showFlash("⚠️ Stock cannot be negative.", "error");
      return;
    }
    const slotExists = medicines.some(
      (m) => m.slot === slot && (!editMode || m.id !== editingMedicineId)
    );
    if (slotExists) {
      showFlash("⚠️ Slot number already exists.", "error");
      return;
    }

    if (editMode) {
      const updated = medicines.map((m) =>
        m.id === editingMedicineId ? { ...m, ...medicineForm, editMode: false } : m
      );
      setMedicines(updated);
      save("ms_medicines", updated);
      addPost(`Updated medicine: ${medicineForm.name}`);
      showFlash(`✏ ${medicineForm.name} updated successfully`, "success");
    } else {
      const newMed = { ...medicineForm, id: uid(), used: 0 };
      const updated = [newMed, ...medicines];
      setMedicines(updated);
      save("ms_medicines", updated);
      addPost(`Added medicine: ${medicineForm.name}`);
      showFlash(`💊 ${medicineForm.name} added successfully`, "success");
    }

    setShowMedicineForm(false);
    setEditingMedicineId(null);
    setMedicineForm({ name: "", row: "", slot: "", stock: 0, expiry: "", editMode: false });
  };


  // --- Expiry Within Month ---
  const expiryWithinMonth = useMemo(() => {
    const now = new Date();
    const monthAhead = new Date();
    monthAhead.setMonth(now.getMonth() + 1);
    return medicines.filter((m) => m.expiry && new Date(m.expiry) <= monthAhead && new Date(m.expiry) >= now);
  }, [medicines]);

  const lowStock = useMemo(() => medicines.filter((m) => Number(m.stock) < 20 && !lowStockOrderSent.includes(m.id)), [medicines, lowStockOrderSent]);

  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierSearch.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.phone || "").includes(q);
  });
  const filteredMedicines = medicines.filter((m) => {
    const q = medicineSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || (m.row || "").toString().includes(q) || (m.slot || "").toString().includes(q);
  });
  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.disease || "").toLowerCase().includes(q) ||
      (p.medicineType || "").toLowerCase().includes(q)
    );
  });

  const summary = {
    totalSuppliers: suppliers.length,
    totalMedicines: medicines.length,
    lowStockCount: lowStock.length,
    expiryCount: expiryWithinMonth.length,
    totalPatients: patients.length,
  };

  const Flash = ({ f }) => {
    if (!f) return null;
    return (
      <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow ${f.type === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
        {f.msg}
      </div>
    );
  };

  if (!user || view === "login") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-sky-600 mb-4">Medical Supply Management</h2>
          <LoginForm onLogin={handleLogin} />
          <p className="text-sm text-gray-500 mt-4">Use username: <b>test</b> & password: <b>test</b></p>
        </div>
        <Flash f={flash} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-sky-600">MediTrack Supply Hub</h1>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Signed in as <b>{user.username}</b></div>
            <button onClick={handleLogout} className="px-3 py-1 bg-white border rounded shadow-sm text-sm">Logout</button>
          </div>
        </header>

        <main className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Sidebar */}
          <aside className="md:col-span-1 bg-white p-4 rounded shadow">
            <nav className="flex flex-col gap-2">
              <button onClick={() => setView("dashboard")} className={`text-left p-2 rounded ${view === 'dashboard' ? 'bg-sky-50' : ''}`}>📊 Dashboard</button>
              <button onClick={() => setView("suppliers")} className={`text-left p-2 rounded ${view === 'suppliers' ? 'bg-sky-50' : ''}`}>🏥 Medical Suppliers</button>
              <button onClick={() => setView("orders")} className={`text-left p-2 rounded ${view === 'orders' ? 'bg-sky-50' : ''}`}>💊 Order Medicines</button>
              <button onClick={() => setView("pharmacy")} className={`text-left p-2 rounded ${view === 'pharmacy' ? 'bg-sky-50' : ''}`}>🧾 Pharmacy Management</button>
              <button onClick={() => setView("patients")} className={`text-left p-2 rounded ${view === 'patients' ? 'bg-sky-50' : ''}`}>🧑‍⚕️ Patient Records</button>
              <button onClick={() => setView("todo")} className={`text-left p-2 rounded ${view === 'todo' ? 'bg-sky-50' : ''}`}>📝 To-Do List</button>
              <button onClick={() => setView("posts")} className={`text-left p-2 rounded ${view === 'posts' ? 'bg-sky-50' : ''}`}>📋 Posts / Logs</button>
              <button onClick={handleLogout} className="text-left p-2 rounded text-rose-600">🚪 Logout</button>
            </nav>
          </aside>

          {/* Main Content */}
          <section className="md:col-span-3">
            <div className="bg-white p-4 rounded shadow">
{view === "dashboard" && (
  <div className="space-y-8">
    <h2 className="text-2xl font-bold mb-4 text-sky-800 flex items-center gap-2">
      📊 Pharmacy Dashboard
    </h2>
    {/* Summary Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="p-6 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-2xl shadow-lg hover:scale-105 transform transition cursor-pointer" onClick={() => setView("suppliers")}>
        <h3 className="text-lg font-semibold mb-2">🏪 Total Suppliers</h3>
        <p className="text-4xl font-bold">{summary.totalSuppliers || 0}</p>
        <p className="mt-2 text-sm opacity-80">Click to view supplier list</p>
      </div>
      <div className="p-6 bg-gradient-to-r from-emerald-700 to-emerald-500 text-white rounded-2xl shadow-lg hover:scale-105 transform transition cursor-pointer" onClick={() => setView("pharmacy")}>
        <h3 className="text-lg font-semibold mb-2">💊 Total Medicines</h3>
        <p className="text-4xl font-bold">{summary.totalMedicines || 0}</p>
        <p className="mt-2 text-sm opacity-80">Explore all available medicines</p>
      </div>
      <div className="p-6 bg-gradient-to-r from-amber-700 to-amber-500 text-white rounded-2xl shadow-lg hover:scale-105 transform transition cursor-pointer" onClick={() => setView("pharmacy")}>
        <h3 className="text-lg font-semibold mb-2">⚠ Low Stock</h3>
        <p className="text-4xl font-bold">{summary.lowStockCount || 0}</p>
        <p className="mt-2 text-sm opacity-80">Medicines running low in stock</p>
      </div>
      <div className="p-6 bg-gradient-to-r from-rose-700 to-rose-500 text-white rounded-2xl shadow-lg hover:scale-105 transform transition cursor-pointer" onClick={() => setView("pharmacy")}>
        <h3 className="text-lg font-semibold mb-2">⏳ Expiring (≤ 1 Month)</h3>
        <p className="text-4xl font-bold">{summary.expiryCount || 0}</p>
        <p className="mt-2 text-sm opacity-80">Medicines nearing expiry date</p>
      </div>
    </div>
    {/* ⚠ Alerts Section */}
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Expiry Medicines */}
      <div className="p-5 rounded-2xl shadow-md border border-rose-300 bg-gradient-to-br from-rose-100 to-rose-50">
        <h4 className="font-semibold text-rose-800 text-lg mb-3 flex items-center gap-2">
          ⚠ Medicines Expiring Soon
        </h4>
        <div className="max-h-48 overflow-auto text-sm">
          {expiryWithinMonth.length ? (
            expiryWithinMonth.map((x) => (
              <div key={x.id} className="py-2 border-b border-rose-200">
                <span className="font-medium text-rose-700">{x.name}</span> —{" "}
                <span className="text-rose-600">{x.expiry}</span>
              </div>
            ))
          ) : (
            <div className="text-gray-600 italic">✅ No medicines expiring soon.</div>
          )}
        </div>
      </div>
      {/* Low Stock Medicines */}
      <div className="p-5 rounded-2xl shadow-md border border-amber-300 bg-gradient-to-br from-amber-100 to-amber-50">
        <h4 className="font-semibold text-amber-800 text-lg mb-3 flex items-center gap-2">
          📦 Low Stock Medicines
        </h4>
        <div className="max-h-48 overflow-auto text-sm">
          {medicines.filter(m => Number(m.stock) < 20).length ? (
            medicines
              .filter(m => Number(m.stock) < 20)
              .map((x) => {
                // Find order sent info for this medicine
                const sentObj = Array.isArray(lowStockOrderSent)
                  ? lowStockOrderSent.find(obj => typeof obj === "object" ? obj.id === x.id : obj === x.id)
                  : null;
                return (
                  <div key={x.id} className="py-2 border-b border-amber-200 flex items-center justify-between">
                    <span>
                      <span className="font-medium text-amber-700">{x.name}</span> — stock:{" "}
                      <span className="font-semibold text-amber-800">{x.stock}</span>
                    </span>
                    {sentObj ? (
                      <span className="ml-2 text-emerald-600 font-bold">
                        ✔ Order Sent at {sentObj.date}
                      </span>
                    ) : null}
                  </div>
                );
              })
          ) : (
            <div className="text-gray-600 italic">✅ All medicines are sufficiently stocked.</div>
          )}
        </div>
      </div>
    </div>
    {/* Expired Medicines Section */}
    <div className="mt-8">
      <h4 className="font-semibold text-rose-700 mb-2">❌ Expired Medicines</h4>
      <div className="max-h-48 overflow-auto text-sm">
        {expiredMedicines.length ? (
          expiredMedicines.map((m) => (
            <div key={m.id} className="py-2 border-b border-rose-200">
              <span className="font-medium text-rose-700">{m.name}</span> —{" "}
              <span className="text-rose-600">{m.expiry}</span>
            </div>
          ))
        ) : (
          <div className="text-gray-600 italic">No expired medicines.</div>
        )}
      </div>
    </div>
    {/* Patients with expiring medicine */}
    <div className="mt-8">
      <h4 className="font-semibold text-rose-700 mb-2">⚠ Patients with Medicine Expiring in 1 Month</h4>
      {dashboardPatientsWithExpiringMedicine.length ? (
        <ul className="list-disc pl-6 text-rose-800">
          {dashboardPatientsWithExpiringMedicine.map((p) => (
            <li key={p.id}>
              <b>{p.name}</b> (Phone: {p.phone}) — <span className="text-rose-600">{p.medicineType}</span> expires on <span className="text-rose-600">{p.medicineExpiry}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">No patients with expiring medicines.</div>
      )}
    </div>
  </div>
)}

{/* To-Do List View */}
{view === "todo" && (
  <div>
    <h2 className="text-2xl font-bold mb-6 text-sky-700 flex items-center gap-2">
      📝 To-Do List
    </h2>
    {/* Expired Medicines */}
    <div className="mb-8">
      <h3 className="font-semibold text-lg text-rose-700 mb-2">Expired Medicines</h3>
      {expiredMedicines.length ? (
        <ul className="space-y-2">
          {expiredMedicines.map((m) => (
            <li key={m.id} className="flex items-center justify-between bg-rose-100 rounded p-2">
              <span>
                <b>{m.name}</b> (Expired: {m.expiry})
              </span>
              <button
                className="px-3 py-1 bg-rose-500 text-white rounded hover:bg-rose-700"
                onClick={() => {
                  if (window.confirm(`Delete expired medicine ${m.name}?`)) {
                    const updated = medicines.filter((med) => med.id !== m.id);
                    setMedicines(updated);
                    save("ms_medicines", updated);
                    addPost(`Deleted expired medicine: ${m.name}`);
                    showFlash(`❌ ${m.name} deleted`, "success");
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">No expired medicines.</div>
      )}
    </div>
    {/* Medicines Expiring Soon */}
    <div className="mb-8">
      <h3 className="font-semibold text-lg text-rose-700 mb-2">Medicines Expiring Soon (≤ 1 month)</h3>
      {expiryWithinMonth.length ? (
        <ul className="space-y-2">
          {expiryWithinMonth.map((m) => (
            <li key={m.id} className="flex items-center justify-between bg-rose-50 rounded p-2">
              <span>
                <b>{m.name}</b> (Expiry: {m.expiry})
              </span>
              <button
                className="px-3 py-1 bg-rose-500 text-white rounded hover:bg-rose-700"
                onClick={() => {
                  if (window.confirm(`Delete expiring medicine ${m.name}?`)) {
                    const updated = medicines.filter((med) => med.id !== m.id);
                    setMedicines(updated);
                    save("ms_medicines", updated);
                    addPost(`Deleted expiring medicine: ${m.name}`);
                    showFlash(`❌ ${m.name} deleted`, "success");
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">No medicines expiring soon.</div>
      )}
    </div>
    {/* Low Stock Medicines */}
    <div className="mb-8">
      <h3 className="font-semibold text-lg text-amber-700 mb-2">Low Stock Medicines</h3>
      {medicines.filter(m => Number(m.stock) < 20).length ? (
        <ul className="space-y-2">
          {medicines.filter(m => Number(m.stock) < 20).map((m) => {
            const sentObj = Array.isArray(lowStockOrderSent)
              ? lowStockOrderSent.find(obj => typeof obj === "object" ? obj.id === m.id : obj === m.id)
              : null;
            return (
              <li key={m.id} className="flex items-center justify-between bg-amber-100 rounded p-2">
                <span>
                  <b>{m.name}</b> (Stock: {m.stock})
                  {sentObj && (
                    <span className="ml-2 text-emerald-600 font-bold">
                      ✔ Order Sent at {sentObj.date}
                    </span>
                  )}
                </span>
                {!sentObj && (
                  <button
                    className="px-3 py-1 bg-sky-500 text-white rounded hover:bg-sky-700"
                    onClick={() => {
                      // Add this medicine to the orderForm.items array (append, don't replace)
                      setOrderForm((prev) => {
                        // If already present, don't add again
                        if (prev.items?.some(item => item.medicine === m.name)) return prev;
                        return {
                          ...prev,
                          items: [...(prev.items || []), { medicine: m.name, quantity: m.stock }]
                        };
                      });
                      setView("orders");
                    }}
                  >
                    Order Placed
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-gray-500">No low stock medicines.</div>
      )}
    </div>
    {/* Patients with Expiring Medicine */}
    <div>
      <h3 className="font-semibold text-lg text-rose-700 mb-2">Patients with Expiring Medicine</h3>
      {patientsWithExpiringMedicine.length ? (
        <ul className="space-y-2">
          {patientsWithExpiringMedicine.map((p) => (
            <li key={p.id} className="flex items-center justify-between bg-rose-100 rounded p-2">
              <span>
                <b>{p.name}</b> (Phone: {p.phone}) — <span className="text-rose-600">{p.medicineType}</span> expires on <span className="text-rose-600">{p.medicineExpiry}</span>
              </span>
              <button
                className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-700"
                onClick={() => {
                  setContactedPatients((arr) => [...arr, p.id]);
                  showFlash(`Contacted ${p.name}`, "success");
                }}
              >
                Contacted
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">No patients to contact.</div>
      )}
    </div>
  </div>
)}
{/* Suppliers View */}
{view === "suppliers" && (
  <div>
    <h2 className="text-2xl font-bold mb-6 text-sky-700 flex items-center gap-2">
      🏥 Medical Suppliers
      <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full">
        {suppliers.length} total
      </span>
    </h2>

    {/* Search and Add Button */}
    <div className="flex gap-2 mb-4">
      <input
        placeholder="Search suppliers by name, email, phone, or ID..."
        value={supplierSearch}
        onChange={(e) => setSupplierSearch(e.target.value)}
        className="flex-1 px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-sky-400 outline-none"
      />
      <button
        onClick={() => {
          setSupplierForm({ id: "", name: "", email: "", phone: "" });
          setShowSupplierForm(true);
        }}
        className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold"
      >
        ➕ Add Supplier
      </button>
    </div>

    {/* Supplier Form */}
    {showSupplierForm && (
      <div className="bg-white p-5 rounded-xl shadow-md border border-sky-100 mb-8 max-w-lg mx-auto">
        <h3 className="font-semibold text-lg mb-3 text-sky-700 flex items-center gap-2">
          {supplierForm.editMode ? "✏ Edit Supplier" : "➕ Add Supplier"}
        </h3>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Supplier ID</label>
          <input
            placeholder="Enter unique supplier ID"
            value={supplierForm.id}
            onChange={(e) => setSupplierForm({ ...supplierForm, id: e.target.value })}
            disabled={supplierForm.editMode} // Prevent editing ID while editing
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none disabled:bg-gray-100"
          />

          <label className="block text-sm font-medium text-gray-700">Supplier Name</label>
          <input
            placeholder="Enter supplier name"
            value={supplierForm.name}
            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            placeholder="Enter supplier email"
            value={supplierForm.email}
            onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <label className="block text-sm font-medium text-gray-700">Phone Number</label>
          <input
            type="tel"
            placeholder="Enter supplier phone number"
            value={supplierForm.phone}
            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                const { id, name, email, phone, editMode } = supplierForm;

                // Validation
                if (!id.trim() || !name.trim() || !email.trim() || !phone.trim()) {
                  showFlash("⚠️ All fields are required!", "error");
                  return;
                }

                // Duplicate checks (block on both add + edit)
                const duplicateId = suppliers.some((s) => s.id === id && !editMode);
                const duplicateEmail = suppliers.some(
                  (s) => s.email === email && (!editMode || s.id !== id)
                );
                const duplicatePhone = suppliers.some(
                  (s) => s.phone === phone && (!editMode || s.id !== id)
                );

                if (duplicateId) {
                  showFlash("⚠️ Supplier ID already exists!", "error");
                  return;
                }
                if (duplicateEmail) {
                  showFlash("⚠️ Email already exists!", "error");
                  return;
                }
                if (duplicatePhone) {
                  showFlash("⚠️ Phone number already exists!", "error");
                  return;
                }

                if (editMode) {
                  // Edit existing
                  setSuppliers((arr) =>
                    arr.map((s) => (s.id === id ? { id, name, email, phone } : s))
                  );
                  addPost(`Updated supplier ${name}`);
                  showFlash("✅ Supplier updated successfully!", "success");
                } else {
                  // Add new supplier (no duplicates allowed)
                  setSuppliers((arr) => [{ id, name, email, phone }, ...arr]);
                  addPost(`Added supplier ${name}`);
                  showFlash("✅ Supplier added successfully!", "success");
                }

                setSupplierForm({ id: "", name: "", email: "", phone: "", editMode: false });
                setShowSupplierForm(false);
              }}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
            >
              💾 Save
            </button>

            <button
              onClick={() => {
                setSupplierForm({ id: "", name: "", email: "", phone: "", editMode: false });
                setShowSupplierForm(false);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Supplier Table */}
    <div className="mt-8 bg-white p-5 rounded-xl shadow-md border border-gray-100">
      <h3 className="font-semibold text-lg text-sky-800 mb-3">📋 Supplier Table</h3>
      <div className="overflow-auto max-h-96 rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-sky-100 text-gray-800 sticky top-0">
            <tr>
              <th className="p-2 border">Supplier ID</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Phone</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length ? (
              filteredSuppliers.map((s, i) => {
                const q = supplierSearch.toLowerCase();
                const isMatch =
                  q &&
                  (s.id.toLowerCase().includes(q) ||
                    s.name.toLowerCase().includes(q) ||
                    (s.email || "").toLowerCase().includes(q) ||
                    (s.phone || "").includes(q));
                return (
                  <tr
                    key={s.id}
                    className={`border-t hover:bg-sky-50 transition ${
                      i % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } ${isMatch ? "bg-yellow-100 font-semibold" : ""}`}
                  >
                    <td className="p-2 border">{s.id}</td>
                    <td className="p-2 border">{s.name}</td>
                    <td className="p-2 border">{s.email}</td>
                    <td className="p-2 border">{s.phone}</td>
                    <td className="p-2 border flex gap-2">
                      <button
                        onClick={() => {
                          setSupplierForm({ ...s, editMode: true });
                          setShowSupplierForm(true);
                        }}
                        className="px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded transition"
                      >
                        ✏ Edit
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete supplier ${s.name}?`)) {
                            setSuppliers((arr) => arr.filter((x) => x.id !== s.id));
                            addPost(`Deleted supplier ${s.name}`);
                            showFlash("Supplier deleted", "success");
                          }
                        }}
                        className="px-2 py-1 bg-rose-200 hover:bg-rose-300 rounded transition"
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="p-2 text-gray-500 text-center">
                  No suppliers added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}

 {/* Orders View */}
{view === "orders" && (
  <div className="p-6 bg-gradient-to-br from-sky-50 to-emerald-50 rounded-xl shadow-md">
    <h2 className="text-2xl font-bold mb-5 text-sky-800">📦 Order Medicines</h2>

    {/* Create Order Section */}
    <div className="p-5 rounded-xl bg-white shadow-md border border-sky-100 mb-6">
      <h3 className="font-semibold text-lg text-emerald-700 mb-4">➕ Create New Order</h3>

      {/* Order ID and Pharmacist Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
          <input
            type="text"
            placeholder="Enter Order ID"
            value={orderForm.id}
            onChange={(e) => setOrderForm({ ...orderForm, id: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacist Email</label>
          <input
            type="email"
            placeholder="Enter pharmacist email"
            value={orderForm.email}
            onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />
        </div>
      </div>

      {/* Multiple Medicines Section */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">🧾 Medicines & Quantities</h4>
        {orderForm.items?.map((item, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <input
              placeholder="Medicine name"
              value={item.medicine}
              onChange={(e) => {
                const updated = [...orderForm.items];
                updated[index].medicine = e.target.value;
                setOrderForm({ ...orderForm, items: updated });
              }}
              className="px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => {
                  const updated = [...orderForm.items];
                  updated[index].quantity = e.target.value;
                  setOrderForm({ ...orderForm, items: updated });
                }}
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
              />
              <button
                onClick={() => {
                  const updated = orderForm.items.filter((_, i) => i !== index);
                  setOrderForm({ ...orderForm, items: updated });
                }}
                className="px-3 py-2 bg-rose-100 hover:bg-rose-200 rounded text-rose-700 transition"
              >
                ❌
              </button>
            </div>
          </div>
        ))}

        {/* Add Medicine Button */}
        <button
          onClick={() =>
            setOrderForm({
              ...orderForm,
              items: [...(orderForm.items || []), { medicine: "", quantity: "" }],
            })
          }
          className="mt-2 px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded transition"
        >
          ➕ Add Medicine
        </button>
      </div>

      {/* Submit Button */}
      <button
        onClick={() => {
          const { id, email, items } = orderForm;
          const itemsArr = Array.isArray(items) ? items : [];

          if (!id.trim() || !email.trim() || itemsArr.length === 0) {
            showFlash("⚠ Please fill all fields!", "error");
            return;
          }

          if (
            itemsArr.some(
              (item) =>
                !item.medicine.trim() ||
                item.quantity === "" ||
                isNaN(Number(item.quantity)) ||
                Number(item.quantity) <= 0
            )
          ) {
            showFlash("⚠ Please fill medicine and quantity fields (quantity must be > 0)!", "error");
            return;
          }

          const duplicate = orders.some((o) => o.id === id);
          if (duplicate) {
            showFlash("⚠ Order ID already exists!", "error");
            return;
          }

          const summary = itemsArr.map((i) => `${i.medicine} - ${i.quantity}`).join(", ");

          // Call sendOrder with correct structure
          sendOrder({
            id,
            medicine: summary,
            quantity: itemsArr.reduce((sum, i) => sum + Number(i.quantity), 0),
            email,
          });

          // Mark all ordered medicines as "order sent" with date/time
          itemsArr.forEach((item) => {
            const med = medicines.find((m) => m.name === item.medicine);
            if (
              med &&
              !lowStockOrderSent.some(obj => typeof obj === "object" ? obj.id === med.id : obj === med.id)
            ) {
              setLowStockOrderSent((arr) => [
                ...arr,
                { id: med.id, date: new Date().toLocaleString() }
              ]);
            }
          });

          // Reset orderForm after sending
          setOrderForm({ id: "", email: "", items: [] });
        }}
        className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold"
      >
        🚚 Send Order
      </button>
    </div>

    {/* Order List */}
    <div className="bg-white p-5 rounded-xl shadow-md border border-sky-100">
      <h3 className="font-semibold text-lg text-sky-800 mb-3">📋 Order List</h3>

      {orders.length ? (
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm border">
            <thead className="bg-sky-100 text-gray-700 sticky top-0">
              <tr>
                <th className="p-2 border">Order ID</th>
                <th className="p-2 border">Medicines</th>
                <th className="p-2 border">Total Quantity</th>
                <th className="p-2 border">Pharmacist Email</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className={`border-t transition ${
                    o.completed ? "bg-emerald-100 font-semibold" : "hover:bg-sky-50"
                  }`}
                >
                  <td className="p-2 border">{o.id}</td>
                  <td className="p-2 border">{o.medicine}</td>
                  <td className="p-2 border">{o.quantity}</td>
                  <td className="p-2 border">{o.email}</td>
                  <td className="p-2 border flex gap-2">
                    <button
  onClick={() => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === o.id ? { ...ord, completed: true } : ord
      )
    );

    // Parse medicine names and quantities from the order
    const medicineItems = o.medicine.split(",").map(s => {
      const [name, qty] = s.split("-").map(str => str.trim());
      return { name, qty: Number(qty) };
    });

    // Update stock for each medicine in the order
    setMedicines((prev) =>
      prev.map(med => {
        const item = medicineItems.find(mi => mi.name === med.name);
        if (item) {
          return { ...med, stock: Number(med.stock) + Number(item.qty) };
        }
        return med;
      })
    );

    // Remove from lowStockOrderSent
    setLowStockOrderSent((arr) =>
      arr.filter(obj => {
        // Remove if any medicine in this order matches
        return !medicineItems.some(mi => {
          if (typeof obj === "object") return obj.id === undefined || obj.id !== (medicines.find(m => m.name === mi.name)?.id);
          return obj !== (medicines.find(m => m.name === mi.name)?.id);
        });
      })
    );

    // Add post/log for received order
    addPost(`✅ Order received: ${o.medicine} (${o.id})`);

    showFlash(`✅ Order ${o.id} marked as received and stock updated`, "success");
  }}
  className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm transition"
>
  ✅ Received
</button>
                    <button
                      onClick={() => {
                        if (window.confirm("Delete this order?")) {
                          setOrders((prev) => prev.filter((ord) => ord.id !== o.id));
                          addPost(`Deleted order ${o.medicine} (${o.id})`);
                          showFlash("Order deleted!", "success");
                        }
                      }}
                      className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm transition"
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-500 text-center py-4">No orders yet.</div>
      )}
    </div>
  </div>
)}

{/* Patient Records View */}
{view === "patients" && (
  <div>
    <h2 className="text-2xl font-bold mb-6 text-sky-700 flex items-center gap-2">
      🧑‍⚕️ Patient Records
      <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full">
        {patients.length} total
      </span>
    </h2>
    {/* Search and Add Button */}
    <div className="flex gap-2 mb-4">
      <input
        placeholder="Search patients by name, phone, email, address, disease, or medicine type..."
        value={patientSearch}
        onChange={(e) => setPatientSearch(e.target.value)}
        className="flex-1 px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-sky-400 outline-none"
      />
      <button
        onClick={() => {
          setPatientForm({
            id: "",
            name: "",
            age: "",
            gender: "",
            phone: "",
            email: "",
            address: "",
            disease: "",
            medicineType: "",
            medicineExpiry: "",
            editMode: false,
          });
          setShowPatientForm(true);
        }}
        className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold"
      >
        ➕ Add Patient
      </button>
    </div>
    {/* Patient Form */}
    {showPatientForm && (
      <div className="bg-white p-5 rounded shadow mb-4 border max-w-lg mx-auto">
        <h3 className="font-semibold text-lg mb-3 text-sky-700 flex items-center gap-2">
          {patientForm.editMode ? "✏ Edit Patient" : "➕ Add Patient"}
        </h3>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={patientForm.name}
            onChange={e => setPatientForm({ ...patientForm, name: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Age</label>
          <input
            value={patientForm.age}
            onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <input
            value={patientForm.gender}
            onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            value={patientForm.phone}
            onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            value={patientForm.email}
            onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <input
            value={patientForm.address}
            onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Disease</label>
          <input
            value={patientForm.disease}
            onChange={e => setPatientForm({ ...patientForm, disease: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Medicine Type</label>
          <input
            value={patientForm.medicineType}
            onChange={e => setPatientForm({ ...patientForm, medicineType: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <label className="block text-sm font-medium text-gray-700">Medicine Expiry</label>
          <input
            type="date"
            value={patientForm.medicineExpiry}
            onChange={e => setPatientForm({ ...patientForm, medicineExpiry: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={savePatient}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
            >
              💾 Save
            </button>
            <button
              onClick={() => {
                setShowPatientForm(false);
                setPatientForm({
                  id: "",
                  name: "",
                  age: "",
                  gender: "",
                  phone: "",
                  email: "",
                  address: "",
                  disease: "",
                  medicineType: "",
                  medicineExpiry: "",
                  editMode: false,
                });
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Patient Table */}
    <div className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-sky-100 text-gray-800 sticky top-0">
          <tr>
            <th className="border-b p-3 text-left">Name</th>
            <th className="border-b p-3 text-left">Age</th>
            <th className="border-b p-3 text-left">Gender</th>
            <th className="border-b p-3 text-left">Phone</th>
            <th className="border-b p-3 text-left">Email</th>
            <th className="border-b p-3 text-left">Address</th>
            <th className="border-b p-3 text-left">Disease</th>
            <th className="border-b p-3 text-left">Medicine</th>
            <th className="border-b p-3 text-left">Expiry</th>
            <th className="border-b p-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredPatients.length > 0 ? (
            filteredPatients.map((p, idx) => (
              <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border-b p-3">{p.name}</td>
                <td className="border-b p-3">{p.age}</td>
                <td className="border-b p-3">{p.gender}</td>
                <td className="border-b p-3">{p.phone}</td>
                <td className="border-b p-3">{p.email}</td>
                <td className="border-b p-3">{p.address}</td>
                <td className="border-b p-3">{p.disease}</td>
                <td className="border-b p-3">{p.medicineType}</td>
                <td className="border-b p-3">{p.medicineExpiry}</td>
                <td className="border-b p-3 flex gap-2 justify-center">
                  <button
                    onClick={() => editPatient(p)}
                    className="px-3 py-1 bg-amber-400 text-white text-sm rounded hover:bg-amber-500 transition"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deletePatient(p.id)}
                    className="px-3 py-1 bg-rose-500 text-white text-sm rounded hover:bg-rose-600 transition"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10" className="p-6 text-center text-gray-500">
                <div className="text-lg">📋 {patientSearch ? "No patients match your search." : "No patients added yet"}</div>
                <div className="text-sm mt-2">Click '➕ Add Patient' to create patient records</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {/* Patients with Expiring Medicine */}
    <div className="mt-6">
      <h4 className="font-semibold text-rose-700 mb-2">⚠ Patients with Medicine Expiring in 1 Month</h4>
      {patientsWithExpiringMedicine.length ? (
        <ul className="list-disc pl-6 text-rose-800">
          {patientsWithExpiringMedicine.map((p) => (
            <li key={p.id}>
              <b>{p.name}</b> (Phone: {p.phone}) — <span className="text-rose-600">{p.medicineType}</span> expires on <span className="text-rose-600">{p.medicineExpiry}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">No patients with expiring medicines.</div>
      )}
    </div>
  </div>
)}

{/* Posts / Logs View */}
{view === "posts" && (
  <div className="p-6 bg-gradient-to-br from-sky-50 to-emerald-50 rounded-xl shadow-md min-h-[70vh]">
    <h2 className="text-2xl font-bold mb-6 text-sky-800">📝 Posts / Logs</h2>
    {posts.length ? (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((p) => {
          let bgColor = "bg-gray-200"; // slightly darker gray
          let textColor = "text-gray-900"; // keep text dark
          if (p.desc.includes("Order sent")) bgColor = "bg-emerald-200";
          else if (p.desc.includes("Deleted order")) bgColor = "bg-rose-200";
          else if (p.desc.includes("Added supplier")) bgColor = "bg-sky-200";
          else if (p.desc.includes("Updated supplier")) bgColor = "bg-yellow-200";
          else if (p.desc.includes("Deleted supplier") || p.desc.includes("Deleted medicine"))
            bgColor = "bg-orange-200";
          else if (p.desc.includes("Added medicine")) bgColor = "bg-purple-200";
          else if (p.desc.includes("Used medicine")) bgColor = "bg-blue-200";

          return (
            <div
              key={p.id}
              className={`${bgColor} ${textColor} p-4 rounded-xl shadow-sm hover:shadow-lg transition transform hover:-translate-y-1`}
            >
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <span>{p.desc.startsWith("📦") ? "📦" : ""}</span>
                <span>{p.desc}</span>
              </div>
              <div className="text-xs text-gray-700">{p.ts}</div> {/* slightly darker */}
            </div>
          );
        })}
      </div>
    ) : (
      <div className="text-gray-500 text-sm">No posts yet.</div>
    )}
  </div>
)}


              {/* Pharmacy Management View */}
              {view === "pharmacy" && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-sky-700 flex items-center gap-2">
                    💊 Pharmacy Management
                    <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full">
                      {medicines.length} total
                    </span>
                  </h2>
                  {/* Search and Add Button */}
                  <div className="flex gap-2 mb-4">
                    <input
                      placeholder="Search medicines by name, row or slot..."
                      value={medicineSearch}
                      onChange={(e) => setMedicineSearch(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                    <button
                      onClick={() => {
                        setMedicineForm({ name: "", row: "", slot: "", stock: 0, expiry: "", editMode: false });
                        setShowMedicineForm(true);
                        setEditingMedicineId(null);
                      }}
                      className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold"
                    >
                      ➕ Add Medicine
                    </button>
                  </div>
                   {/* Add/Edit Medicine Form */}

                   {showMedicineForm && (
      <div className="bg-white p-5 rounded-xl shadow-md border border-sky-100 mb-8 max-w-lg mx-auto">
        <h3 className="font-semibold text-lg mb-3 text-sky-700 flex items-center gap-2">
          {medicineForm.editMode ? "✏ Edit Medicine" : "➕ Add Medicine"}
        </h3>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Medicine Name</label>
          <input
            placeholder="Enter medicine name"
            value={medicineForm.name}
            onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <label className="block text-sm font-medium text-gray-700">Row Number</label>
          <input
            placeholder="Enter row number"
            value={medicineForm.row}
            onChange={(e) => setMedicineForm({ ...medicineForm, row: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <label className="block text-sm font-medium text-gray-700">Slot Number</label>
          <input
            placeholder="Enter slot number (must be unique)"
            value={medicineForm.slot}
            onChange={(e) => setMedicineForm({ ...medicineForm, slot: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <label className="block text-sm font-medium text-gray-700">Quantity (Stock)</label>
          <input
            type="number"
            min="0"
            placeholder="Enter medicine quantity (≥ 0)"
            value={medicineForm.stock}
            onChange={(e) => setMedicineForm({ ...medicineForm, stock: Number(e.target.value) })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
          <input
            type="date"
            value={medicineForm.expiry}
            onChange={(e) => setMedicineForm({ ...medicineForm, expiry: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-sky-300 outline-none"
          />

          <div className="flex gap-2 mt-3">
            <button
              onClick={saveMedicine}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
            >
              💾 Save
            </button>

            <button
              onClick={() => {
                setShowMedicineForm(false);
                setEditingMedicineId(null);
                setMedicineForm({ name: "", row: "", slot: "", stock: 0, expiry: "", editMode: false });
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
                  {/* Medicine Table + Alerts */}
                  {(() => {
                    const now = new Date();
                    const monthAhead = new Date();
                    monthAhead.setMonth(now.getMonth() + 1);

                    const expiryWithinMonth = medicines.filter(
                      (m) => m.expiry && new Date(m.expiry) <= monthAhead && new Date(m.expiry) >= now
                    );
                    const lowStock = medicines.filter((m) => Number(m.stock) < 20 && !lowStockOrderSent.includes(m.id));

                    const expiryIds = new Set(expiryWithinMonth.map((m) => m.id));
                    const lowIds = new Set(lowStock.map((m) => m.id));
                    const orderedIds = new Set(lowStockOrderSent);

                    // Filter medicines based on search
                    const filteredMedicines = medicines.filter((m) => {
                      const search = medicineSearch.toLowerCase();
                      return (
                        m.name.toLowerCase().includes(search) ||
                        m.row.toString().toLowerCase().includes(search) ||
                        m.slot.toString().toLowerCase().includes(search)
                      );
                    });

                    return (
                      <div>
                        {/* Medicine Table */}
                        <div className="mt-4 bg-white p-5 rounded-xl shadow-md border border-gray-100">
                          <h3 className="font-semibold text-lg text-sky-800 mb-3">📦 Medicine Table</h3>
                          <div className="overflow-auto max-h-96 rounded-lg border border-gray-200">
                            <table className="w-full text-sm">
                              <thead className="bg-sky-100 text-gray-800 sticky top-0">
                                <tr>
                                  <th className="p-2 border">Name</th>
                                  <th className="p-2 border">Row</th>
                                  <th className="p-2 border">Slot</th>
                                  <th className="p-2 border">Stock</th>
                                  <th className="p-2 border">Used</th>
                                  <th className="p-2 border">Expiry</th>
                                  <th className="p-2 border">Actions</th>
                                </tr>
                              </thead>
         <tbody>
  {filteredMedicines.length > 0 ? (
    filteredMedicines.map((m, i) => {
      const now = new Date();
      const expiryDate = m.expiry ? new Date(m.expiry) : null;
      const isExpired = expiryDate && expiryDate < now;
      const monthAhead = new Date();
      monthAhead.setMonth(now.getMonth() + 1);
      const isExpiringSoon = expiryDate && expiryDate >= now && expiryDate <= monthAhead;
      const isLow = Number(m.stock) < 20;
      const isOrdered = Array.isArray(lowStockOrderSent)
        ? lowStockOrderSent.some(obj => typeof obj === "object" ? obj.id === m.id : obj === m.id)
        : false;

   
      // Search match
      const search = medicineSearch.toLowerCase();
      const isSearchMatch =
        search &&
        (m.name.toLowerCase().includes(search) ||
          m.row.toString().toLowerCase().includes(search) ||
          m.slot.toString().toLowerCase().includes(search));

      let rowClass = "";
      if (isSearchMatch) rowClass = "bg-sky-900 text-white";
      else if (isExpired) rowClass = "bg-rose-400 text-white";
      else if (isExpiringSoon) rowClass = "bg-pink-200";
      else if (isOrdered) rowClass = "bg-blue-200";
      else if (isLow) rowClass = "bg-amber-200";

      return (
        <tr key={m.id} className={`border-t transition ${i % 2 === 0 ? "bg-gray-50" : "bg-white"} ${rowClass}`}>
          <td className="p-2 border">{m.name}</td>
          <td className="p-2 border">{m.row}</td>
          <td className="p-2 border">{m.slot}</td>
          <td className="p-2 border font-semibold text-emerald-700 flex items-center gap-1">
            {m.stock}
            {Array.isArray(lowStockOrderSent) &&
              (() => {
                const sentObj = lowStockOrderSent.find(obj => typeof obj === "object" ? obj.id === m.id : obj === m.id);
                return sentObj
                  ? (
                    <span className="ml-2 flex items-center gap-1 text-emerald-600" title="Order Sent">
                      ✔ <span className="text-xs">Order Sent{sentObj.date ? ` (${sentObj.date})` : ""}</span>
                    </span>
                  )
                  : null;
              })()
            }
          </td>
          <td className="p-2 border">{m.used || 0}</td>
          <td className="p-2 border">{m.expiry}</td>
          <td className="p-2 border flex gap-1">
            <button
              onClick={() => {
                setMedicineForm({ ...m, editMode: true });
                setEditingMedicineId(m.id);
                setShowMedicineForm(true);
              }}
              className="px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded transition"
            >
              ✏ Edit
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete medicine ${m.name}?`)) {
                  const updated = medicines.filter((med) => med.id !== m.id);
                  setMedicines(updated);
                  save("ms_medicines", updated);
                  addPost(`Deleted medicine: ${m.name}`);
                  showFlash(`❌ ${m.name} deleted`, "success");
                }
              }}
              className="px-2 py-1 bg-rose-200 hover:bg-rose-300 rounded transition"
            >
              🗑 Delete
            </button>
            <button
              onClick={() => {
                if (m.stock <= 0) {
                  showFlash(`⚠ ${m.name} stock is empty. Cannot use medicine.`, "error");
                  return;
                }
                const usedQty = parseInt(prompt(`Enter used quantity for ${m.name} (available: ${m.stock})`));
                if (isNaN(usedQty) || usedQty <= 0) return;
                if (usedQty > m.stock) {
                  showFlash(`⚠ Not enough stock of ${m.name}. Available: ${m.stock}`, "error");
                  return;
                }
                const updated = medicines.map((med) =>
                  med.id === m.id
                    ? {
                        ...med,
                        used: (med.used || 0) + usedQty,
                        stock: med.stock - usedQty,
                      }
                    : med
                );
                setMedicines(updated);
                save("ms_medicines", updated);
                showFlash(`✅ ${m.name}: ${usedQty} used. Stock updated.`, "success");
                const newLog = { id: uid(), desc: `Used medicine: ${m.name} (Quantity: ${usedQty})`, ts: nowStr() };
                setPosts([newLog, ...posts]);
              }}
              className="px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded transition"
            >
              ➖ Use
            </button>
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan="7" className="text-center py-4 text-gray-500">
        No medicines found.
      </td>
    </tr>
  )}
</tbody>
                            </table>
                          </div>
                        </div>
                        {/* ⚠ Alerts Section */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Expiry */}
                          <div className="p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50">
                            <h4 className="font-semibold text-rose-700 mb-2">⚠ Expiry Medicines (≤ 1 month)</h4>
                            <div className="max-h-48 overflow-auto text-sm">
                              {expiryWithinMonth.length ? (
                                expiryWithinMonth.map((x) => (
                                  <div key={x.id} className="py-1 border-b border-rose-100">
                                    {x.name} — <span className="text-rose-600">{x.expiry}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-500">No medicines expiring soon.</div>
                              )}
                            </div>
                          </div>
                          {/* Low Stock */}
                          <div className="p-4 rounded-xl shadow-sm border border-amber-200 bg-amber-50">
                            <h4 className="font-semibold text-amber-700 mb-2">⚠ Low Stock (&lt; 20)</h4>
                            <div className="max-h-48 overflow-auto text-sm">
                             {lowStock.length ? (
  lowStock.map((x) => {
    const sentObj = Array.isArray(lowStockOrderSent)
      ? lowStockOrderSent.find(obj => typeof obj === "object" ? obj.id === x.id : obj === x.id)
      : null;
    return (
      <div key={x.id} className="py-1 border-b border-amber-100 flex items-center justify-between">
        <span>
          {x.name} — stock: <span className="text-amber-700 font-medium">{x.stock}</span>
        </span>
        {sentObj && (
          <span className="ml-2 text-emerald-600 font-bold">
            ✔ Order Sent{sentObj.date ? ` at ${sentObj.date}` : ""}
          </span>
        )}
      </div>
    );
  })
) : (
  <div className="text-gray-500">All medicines are sufficiently stocked.</div>
)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          </section>
        </main>
      </div>
      <Flash f={flash} />
    </div>
  );
}

/* Subcomponents */
function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div>
      <label className="block text-sm text-gray-600">Username</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border rounded mb-3" />
      <label className="block text-sm text-gray-600">Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded mb-3" />
      <div className="flex gap-2">
        <button onClick={() => onLogin(username, password)} className="px-4 py-2 bg-sky-600 text-white rounded">Login</button>
        <button onClick={() => { setUsername('test'); setPassword('test'); }} className="px-4 py-2 bg-gray-200 rounded">Fill test</button>
      </div>
    </div>
  );
}
function Card({ title, value, onView }) {
  return (
    <div className="p-4 border rounded shadow-sm bg-white">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-2">
        <button onClick={onView} className="px-3 py-1 text-sm bg-sky-50 rounded">View</button>
      </div>
    </div>
  );
}

function SimpleTable({ data, cols }) {
  if (!data.length) return <div className="text-gray-500">No records.</div>;
  return (
    <table className="w-full text-sm mt-2">
      <thead className="text-left text-gray-600"><tr>{cols.map(c => <th key={c} className="p-1">{c}</th>)}</tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i} className="border-t">
            {cols.map(c => <td key={c} className="p-1">{r[c]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}


