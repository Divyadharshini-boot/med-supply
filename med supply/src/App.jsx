import React, { useEffect, useState, useMemo } from "react";
import emailjs from "emailjs-com"; // ✅ Keep this line
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

  // Helper to show flash and then show expiry/low stock after
  const showFlash = (msg, type = "success") => {
    setFlash({ type, msg });
    // After 3.5s, show expiry/low stock if needed
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
    const lowStock = medicines.filter((m) => Number(m.stock) < 20);
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
        // After flash disappears, show expiry/low stock if needed
        showExpiryLowStockFlash();
      }, 3500);
      return () => clearTimeout(t);
    } else {
      // When flash is cleared, show expiry/low stock if needed
      showExpiryLowStockFlash();
    }
    // eslint-disable-next-line
  }, [flash, user]);

  const [suppliers, setSuppliers] = useState(() => load("ms_suppliers", []));
  const [medicines, setMedicines] = useState(() => load("ms_medicines", []));
  const [orders, setOrders] = useState(() => load("ms_orders", []));
  const [posts, setPosts] = useState(() => load("ms_posts", []));

  useEffect(() => save("ms_suppliers", suppliers), [suppliers]);
  useEffect(() => save("ms_medicines", medicines), [medicines]);
  useEffect(() => save("ms_orders", orders), [orders]);
  useEffect(() => save("ms_posts", posts), [posts]);

  const [view, setView] = useState("dashboard");
  const [supplierForm, setSupplierForm] = useState({ id: "", name: "", email: "", phone: "" });
  const [supplierSearch, setSupplierSearch] = useState("");
  const [orderForm, setOrderForm] = useState({ id: "", email: "", items: [] });
  const [medicineForm, setMedicineForm] = useState({ id: "", name: "", row: "", slot: "", stock: 0, expiry: "" });
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState(null);

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

  const expiryWithinMonth = useMemo(() => {
    const now = new Date();
    const monthAhead = new Date();
    monthAhead.setMonth(now.getMonth() + 1);
    return medicines.filter((m) => m.expiry && new Date(m.expiry) <= monthAhead && new Date(m.expiry) >= now);
  }, [medicines]);

  const lowStock = useMemo(() => medicines.filter((m) => Number(m.stock) < 20), [medicines]);

  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierSearch.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.phone || "").includes(q);
  });
  const filteredMedicines = medicines.filter((m) => {
    const q = medicineSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || (m.row || "").toString().includes(q) || (m.slot || "").toString().includes(q);
  });

  const summary = { totalSuppliers: suppliers.length, totalMedicines: medicines.length, lowStockCount: lowStock.length, expiryCount: expiryWithinMonth.length };

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
              <button onClick={() => setView("posts")} className={`text-left p-2 rounded ${view === 'posts' ? 'bg-sky-50' : ''}`}>📋 Posts / Logs</button>
              <button onClick={handleLogout} className="text-left p-2 rounded text-rose-600">🚪 Logout</button>
            </nav>
          </aside>

          {/* Main Content */}
          <section className="md:col-span-3">
            <div className="bg-white p-4 rounded shadow">
              {/* Dashboard View */}
              {view === "dashboard" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card title="Total Suppliers" value={summary.totalSuppliers} onView={() => setView('suppliers')} />
                    <Card title="Total Medicines" value={summary.totalMedicines} onView={() => setView('pharmacy')} />
                    <Card title="Low Stock" value={summary.lowStockCount} onView={() => setView('pharmacy')} />
                    <Card title="Expiring (1m)" value={summary.expiryCount} onView={() => setView('pharmacy')} />
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

          // Fix: items may be undefined, so default to []
          const itemsArr = Array.isArray(items) ? items : [];

          if (!id.trim() || !email.trim() || itemsArr.length === 0) {
            showFlash("⚠ Please fill all fields!", "error");
            return;
          }

          // Check for empty medicine or quantity (must be >0 and not empty string)
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

          // Prevent duplicate Order ID
          const duplicate = orders.some((o) => o.id === id);
          if (duplicate) {
            showFlash("⚠ Order ID already exists!", "error");
            return;
          }

          // Create readable medicine summary
          const summary = itemsArr.map((i) => `${i.medicine} - ${i.quantity}`).join(", ");

          // Call sendOrder with correct structure
          sendOrder({
            id,
            medicine: summary,
            quantity: itemsArr.reduce((sum, i) => sum + Number(i.quantity), 0),
            email,
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
                        showFlash(`✅ Order ${o.id} marked as received`, "success");
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
      const lowStock = medicines.filter((m) => Number(m.stock) < 20);

      const expiryIds = new Set(expiryWithinMonth.map((m) => m.id));
      const lowIds = new Set(lowStock.map((m) => m.id));

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
                      const isExpiring = expiryIds.has(m.id);
                      const isLow = lowIds.has(m.id);

                      let rowClass = "";
                      if (isExpiring && isLow) rowClass = "bg-red-200";
                      else if (isExpiring) rowClass = "bg-pink-300";
                      else if (isLow) rowClass = "bg-amber-200";

                      // Highlight search match
                      if (medicineSearch && !m.name.toLowerCase().includes(medicineSearch.toLowerCase()) &&
                          !m.row.toString().includes(medicineSearch) &&
                          !m.slot.toString().includes(medicineSearch)) rowClass = "";

                      return (
                        <tr key={m.id} className={`border-t transition ${i % 2 === 0 ? "bg-gray-50" : "bg-white"} ${rowClass}`}>
                          <td className="p-2 border">{m.name}</td>
                          <td className="p-2 border">{m.row}</td>
                          <td className="p-2 border">{m.slot}</td>
                          <td className="p-2 border font-semibold text-emerald-700">{m.stock}</td>
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
                  lowStock.map((x) => (
                    <div key={x.id} className="py-1 border-b border-amber-100">
                      {x.name} — stock: <span className="text-amber-700 font-medium">{x.stock}</span>
                    </div>
                  ))
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