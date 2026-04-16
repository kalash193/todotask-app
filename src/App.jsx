import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() || "/api";
const priorities = ["Low", "Medium", "High", "Urgent"];
const adminStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "submitted", label: "Submitted for Review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const statusTone = {
  pending: { bg: "#f4ead8", text: "#7c5b17" },
  "in-progress": { bg: "#deefff", text: "#155d97" },
  submitted: { bg: "#ece4ff", text: "#5d44c1" },
  verified: { bg: "#ddf2e1", text: "#1e7d46" },
  rejected: { bg: "#fde4e4", text: "#b13c3c" },
};

const emptyCreateForm = {
  title: "",
  description: "",
  priority: "Medium",
  deadline: "",
  assigneeId: "",
  status: "pending",
};

function getToken() {
  return window.localStorage.getItem("taskflow-token") || "";
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot reach the server. If this is deployed on Vercel, set VITE_API_BASE_URL to your backend URL.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function statusLabel(status) {
  return (
    adminStatusOptions.find((item) => item.value === status)?.label || status
  );
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [auth, setAuth] = useState({ user: null, token: getToken() });
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [taskForm, setTaskForm] = useState(emptyCreateForm);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [employeeNotes, setEmployeeNotes] = useState({});
  const [reviewFeedback, setReviewFeedback] = useState({});

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      const token = getToken();

      if (!token) {
        if (!ignore) {
          setLoading(false);
        }
        return;
      }

      try {
        const session = await api("/auth/me");
        if (!ignore) {
          setAuth({ user: session.user, token });
        }
      } catch {
        window.localStorage.removeItem("taskflow-token");
        if (!ignore) {
          setAuth({ user: null, token: "" });
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!auth.user) {
      setTasks([]);
      setEmployees([]);
      return;
    }

    let ignore = false;

    async function loadWorkspace() {
      setLoading(true);
      try {
        const [taskData, employeeData] = await Promise.all([
          api("/todos"),
          auth.user.role === "admin"
            ? api("/employees")
            : Promise.resolve({ employees: [] }),
        ]);

        if (!ignore) {
          setTasks(taskData.todos);
          setEmployees(employeeData.employees);
          if (
            auth.user.role === "admin" &&
            employeeData.employees.length > 0 &&
            !taskForm.assigneeId
          ) {
            setTaskForm((current) => ({
              ...current,
              assigneeId: employeeData.employees[0].id,
            }));
          }
        }
      } catch (error) {
        if (!ignore) {
          showMessage(error.message, "error");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();
    return () => {
      ignore = true;
    };
  }, [auth.user]);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => setMessage(null), 3000);
  }

  function logout() {
    window.localStorage.removeItem("taskflow-token");
    setAuth({ user: null, token: "" });
    setTaskForm(emptyCreateForm);
    setEditingTaskId(null);
    showMessage("Signed out");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      window.localStorage.setItem("taskflow-token", data.token);
      setAuth({ user: data.user, token: data.token });
      setLoginForm({ email: "", password: "" });
      showMessage(`Welcome back, ${data.user.name}`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });
      window.localStorage.setItem("taskflow-token", data.token);
      setAuth({ user: data.user, token: data.token });
      setRegisterForm({ name: "", email: "", password: "" });
      showMessage("Employee account created");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        deadline: taskForm.deadline,
        assigneeId: taskForm.assigneeId,
        status: taskForm.status,
      };

      if (editingTaskId) {
        const data = await api(`/todos/${editingTaskId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setTasks((current) =>
          current.map((task) => (task.id === editingTaskId ? data.todo : task)),
        );
        showMessage("Task updated");
      } else {
        const data = await api("/todos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setTasks((current) => [data.todo, ...current]);
        showMessage("Task assigned to employee");
      }

      setEditingTaskId(null);
      setTaskForm((current) => ({
        ...emptyCreateForm,
        assigneeId: employees[0]?.id || "",
      }));
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(taskId) {
    setSaving(true);
    try {
      await api(`/todos/${taskId}`, { method: "DELETE" });
      setTasks((current) => current.filter((task) => task.id !== taskId));
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setTaskForm((current) => ({
          ...emptyCreateForm,
          assigneeId: employees[0]?.id || "",
        }));
      }
      showMessage("Task deleted");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      deadline: task.deadline || "",
      assigneeId: task.assigneeId,
      status: task.status,
    });
  }

  async function updateEmployeeTask(taskId, status) {
    setSaving(true);
    try {
      const data = await api(`/todos/${taskId}/employee-update`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          completionNote: employeeNotes[taskId] || "",
        }),
      });
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? data.todo : task)),
      );
      showMessage(
        status === "submitted"
          ? "Submitted to admin for review"
          : "Task moved to in-progress",
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function reviewTask(taskId, decision) {
    setSaving(true);
    try {
      const data = await api(`/todos/${taskId}/review`, {
        method: "PUT",
        body: JSON.stringify({
          decision,
          adminFeedback: reviewFeedback[taskId] || "",
        }),
      });
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? data.todo : task)),
      );
      showMessage(
        decision === "verified"
          ? "Task verified successfully"
          : "Task sent back to employee",
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const reviewQueue = tasks.filter((task) => task.status === "submitted").length;
  const verifiedCount = tasks.filter((task) => task.status === "verified").length;
  const employeeRejectedCount = tasks.filter(
    (task) => task.status === "rejected",
  ).length;

  if (loading && !auth.user) {
    return <div style={styles.loading}>Loading TaskFlow...</div>;
  }

  if (!auth.user) {
    return (
      <div style={styles.shell}>
        <div style={styles.heroPanel}>
          <div style={styles.heroBadge}>Employee + admin workflow</div>
          <h1 style={styles.heroTitle}>Employees submit. Admins verify.</h1>
          <p style={styles.heroText}>
            Admins assign tasks and review submitted work. Employees finish only
            their assigned tasks and send them for approval.
          </p>
          <div style={styles.demoBox}>
            <div style={styles.demoTitle}>Demo logins</div>
            <div style={styles.demoLine}>Admin: admin@taskflow.local / admin123</div>
            <div style={styles.demoLine}>
              Employee: employee@taskflow.local / employee123
            </div>
          </div>
        </div>

        <div style={styles.authPanel}>
          <div style={styles.tabs}>
            <button
              style={mode === "login" ? styles.tabActive : styles.tab}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              style={mode === "register" ? styles.tabActive : styles.tab}
              onClick={() => setMode("register")}
            >
              Employee Signup
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} style={styles.formCard}>
              <label style={styles.label}>
                Email
                <input
                  style={styles.input}
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={styles.label}>
                Password
                <input
                  style={styles.input}
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <button style={styles.primaryButton} disabled={saving}>
                {saving ? "Signing in..." : "Login"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={styles.formCard}>
              <label style={styles.label}>
                Name
                <input
                  style={styles.input}
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={styles.label}>
                Email
                <input
                  style={styles.input}
                  type="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={styles.label}>
                Password
                <input
                  style={styles.input}
                  type="password"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <button style={styles.primaryButton} disabled={saving}>
                {saving ? "Creating..." : "Create Employee Account"}
              </button>
            </form>
          )}
        </div>

        {message && (
          <div
            style={
              message.type === "error" ? styles.toastError : styles.toastSuccess
            }
          >
            {message.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            {auth.user.role === "admin" ? "Admin panel" : "Employee panel"}
          </div>
          <h1 style={styles.dashboardTitle}>Welcome, {auth.user.name}</h1>
          <p style={styles.dashboardText}>
            {auth.user.role === "admin"
              ? "Assign tasks, review submitted work, and verify whether the task is truly complete."
              : "Work on your assigned tasks, add notes, and submit them for admin approval."}
          </p>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.rolePill}>{auth.user.role}</span>
          <button style={styles.secondaryButton} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section style={styles.statsGrid}>
        {(auth.user.role === "admin"
          ? [
              { label: "All Tasks", value: tasks.length },
              { label: "Need Review", value: reviewQueue },
              { label: "Verified", value: verifiedCount },
              { label: "Employees", value: employees.length },
            ]
          : [
              { label: "My Tasks", value: tasks.length },
              {
                label: "In Progress",
                value: tasks.filter((task) => task.status === "in-progress").length,
              },
              {
                label: "Waiting Review",
                value: tasks.filter((task) => task.status === "submitted").length,
              },
              { label: "Rejected", value: employeeRejectedCount },
            ]
        ).map((item) => (
          <div key={item.label} style={styles.statCard}>
            <div style={styles.statValue}>{item.value}</div>
            <div style={styles.statLabel}>{item.label}</div>
          </div>
        ))}
      </section>

      <section
        style={
          auth.user.role === "admin" ? styles.workspace : styles.employeeWorkspace
        }
      >
        {auth.user.role === "admin" && (
          <form onSubmit={handleTaskSubmit} style={styles.editorPanel}>
            <div style={styles.panelTitle}>
              {editingTaskId ? "Edit assigned task" : "Assign new task"}
            </div>
            <label style={styles.label}>
              Task title
              <input
                style={styles.input}
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label style={styles.label}>
              Description
              <textarea
                style={styles.textarea}
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label style={styles.label}>
              Assign employee
              <select
                style={styles.input}
                value={taskForm.assigneeId}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    assigneeId: event.target.value,
                  }))
                }
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.email})
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Priority
              <select
                style={styles.input}
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Deadline
              <input
                style={styles.input}
                type="date"
                value={taskForm.deadline}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    deadline: event.target.value,
                  }))
                }
              />
            </label>
            {editingTaskId && (
              <label style={styles.label}>
                Status
                <select
                  style={styles.input}
                  value={taskForm.status}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  {adminStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button style={styles.primaryButton} disabled={saving}>
              {saving
                ? "Saving..."
                : editingTaskId
                  ? "Update Task"
                  : "Assign Task"}
            </button>
          </form>
        )}

        <div style={styles.listPanel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>
              {auth.user.role === "admin"
                ? "Assigned task board"
                : "Tasks assigned to you"}
            </div>
            {auth.user.role === "admin" && reviewQueue > 0 && (
              <div style={styles.reviewChip}>{reviewQueue} waiting review</div>
            )}
          </div>
          {loading ? (
            <div style={styles.emptyState}>Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div style={styles.emptyState}>
              {auth.user.role === "admin"
                ? "No tasks assigned yet."
                : "No tasks assigned to you yet."}
            </div>
          ) : (
            <div style={styles.todoList}>
              {tasks.map((task) => (
                <article key={task.id} style={styles.todoCard}>
                  <div style={styles.todoTop}>
                    <div>
                      <h3 style={styles.todoTitle}>{task.title}</h3>
                      <div style={styles.metaRow}>
                        <span style={styles.metaText}>
                          Assigned to {task.assigneeName}
                        </span>
                        {task.deadline && (
                          <span style={styles.metaText}>Due {task.deadline}</span>
                        )}
                        {auth.user.role === "employee" && (
                          <span style={styles.metaText}>
                            Created by {task.createdByName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: statusTone[task.status].bg,
                        color: statusTone[task.status].text,
                      }}
                    >
                      {statusLabel(task.status)}
                    </span>
                  </div>

                  {task.description && (
                    <p style={styles.todoDescription}>{task.description}</p>
                  )}

                  <div style={styles.todoBottom}>
                    <span style={styles.priorityPill}>{task.priority}</span>
                    <span style={styles.metaText}>
                      Updated {new Date(task.updatedAt).toLocaleString("en-IN")}
                    </span>
                  </div>

                  {task.completionNote && (
                    <div style={styles.noteBlock}>
                      <div style={styles.noteTitle}>Employee completion note</div>
                      <div style={styles.noteText}>{task.completionNote}</div>
                    </div>
                  )}

                  {task.adminFeedback && (
                    <div style={styles.feedbackBlock}>
                      <div style={styles.noteTitle}>Admin feedback</div>
                      <div style={styles.noteText}>{task.adminFeedback}</div>
                    </div>
                  )}

                  {auth.user.role === "employee" &&
                    task.assigneeId === auth.user.id &&
                    ["pending", "in-progress", "rejected"].includes(task.status) && (
                      <div style={styles.actionPanel}>
                        <textarea
                          style={styles.textareaCompact}
                          placeholder="Write what you finished before submitting to admin"
                          value={employeeNotes[task.id] ?? task.completionNote ?? ""}
                          onChange={(event) =>
                            setEmployeeNotes((current) => ({
                              ...current,
                              [task.id]: event.target.value,
                            }))
                          }
                        />
                        <div style={styles.todoActions}>
                          {task.status === "pending" && (
                            <button
                              style={styles.secondaryButton}
                              onClick={() => updateEmployeeTask(task.id, "in-progress")}
                            >
                              Start work
                            </button>
                          )}
                          <button
                            style={styles.primaryButton}
                            onClick={() => updateEmployeeTask(task.id, "submitted")}
                          >
                            Submit to admin
                          </button>
                        </div>
                      </div>
                    )}

                  {auth.user.role === "admin" && (
                    <div style={styles.actionPanel}>
                      {task.status === "submitted" && (
                        <>
                          <textarea
                            style={styles.textareaCompact}
                            placeholder="Add feedback if you want changes or notes for approval"
                            value={reviewFeedback[task.id] || ""}
                            onChange={(event) =>
                              setReviewFeedback((current) => ({
                                ...current,
                                [task.id]: event.target.value,
                              }))
                            }
                          />
                          <div style={styles.todoActions}>
                            <button
                              style={styles.primaryButton}
                              onClick={() => reviewTask(task.id, "verified")}
                            >
                              Verify complete
                            </button>
                            <button
                              style={styles.deleteButton}
                              onClick={() => reviewTask(task.id, "rejected")}
                            >
                              Send back
                            </button>
                          </div>
                        </>
                      )}
                      <div style={styles.todoActions}>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => startEdit(task)}
                        >
                          Edit
                        </button>
                        <button
                          style={styles.deleteButton}
                          onClick={() => handleDelete(task.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {message && (
        <div
          style={
            message.type === "error" ? styles.toastError : styles.toastSuccess
          }
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

const styles = {
  loading: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f1eb", color: "#17324d", fontSize: "1.1rem" },
  shell: { minHeight: "100vh", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", background: "linear-gradient(135deg, #f7efe2 0%, #f0e7db 48%, #d8e7f1 100%)" },
  heroPanel: { padding: "4rem", display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.2rem" },
  heroBadge: { display: "inline-flex", width: "fit-content", padding: "0.4rem 0.8rem", borderRadius: "999px", background: "#17324d", color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.82rem" },
  heroTitle: { margin: 0, fontSize: "3rem", lineHeight: 1, color: "#13283b" },
  heroText: { margin: 0, maxWidth: "38rem", color: "#4c6072", fontSize: "1.04rem" },
  demoBox: { width: "fit-content", padding: "1rem 1.1rem", borderRadius: "1rem", background: "rgba(255,255,255,0.75)", border: "1px solid rgba(19,40,59,0.1)" },
  demoTitle: { color: "#13283b", fontWeight: 700, marginBottom: "0.4rem" },
  demoLine: { color: "#506778", fontSize: "0.94rem" },
  authPanel: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "3rem", background: "rgba(255,255,255,0.76)", backdropFilter: "blur(12px)" },
  tabs: { display: "flex", gap: "0.75rem", marginBottom: "1.25rem" },
  tab: { flex: 1, padding: "0.95rem", borderRadius: "0.95rem", border: "1px solid #cad6de", background: "#fff", color: "#355166", cursor: "pointer", fontWeight: 600 },
  tabActive: { flex: 1, padding: "0.95rem", borderRadius: "0.95rem", border: "1px solid #13283b", background: "#13283b", color: "#fff", cursor: "pointer", fontWeight: 600 },
  formCard: { display: "grid", gap: "1rem", padding: "1.5rem", borderRadius: "1.25rem", background: "#fff", border: "1px solid rgba(19,40,59,0.12)", boxShadow: "0 18px 40px rgba(19,40,59,0.08)" },
  label: { display: "grid", gap: "0.45rem", fontSize: "0.95rem", color: "#26445d", fontWeight: 600 },
  input: { width: "100%", boxSizing: "border-box", padding: "0.9rem 1rem", borderRadius: "0.85rem", border: "1px solid #c7d2da", background: "#fcfdff", fontSize: "0.95rem", fontFamily: "inherit" },
  textarea: { width: "100%", boxSizing: "border-box", minHeight: "7rem", padding: "0.9rem 1rem", borderRadius: "0.85rem", border: "1px solid #c7d2da", background: "#fcfdff", fontSize: "0.95rem", fontFamily: "inherit", resize: "vertical" },
  textareaCompact: { width: "100%", boxSizing: "border-box", minHeight: "5.5rem", padding: "0.85rem 0.95rem", borderRadius: "0.85rem", border: "1px solid #c7d2da", background: "#fcfdff", fontSize: "0.92rem", fontFamily: "inherit", resize: "vertical" },
  primaryButton: { padding: "0.95rem 1rem", borderRadius: "0.95rem", border: "none", background: "#13283b", color: "#fff", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { padding: "0.8rem 1rem", borderRadius: "0.9rem", border: "1px solid #c7d2da", background: "#fff", color: "#1f425d", fontWeight: 600, cursor: "pointer" },
  deleteButton: { padding: "0.8rem 1rem", borderRadius: "0.9rem", border: "none", background: "#c94949", color: "#fff", fontWeight: 600, cursor: "pointer" },
  dashboard: { minHeight: "100vh", background: "radial-gradient(circle at top left, #f6ebd9 0, #eff2f6 45%, #e8eef0 100%)", padding: "2rem", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" },
  eyebrow: { color: "#8a5d2c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.78rem", fontWeight: 700 },
  dashboardTitle: { margin: "0.35rem 0", fontSize: "2.2rem", color: "#13283b" },
  dashboardText: { margin: 0, color: "#476073", maxWidth: "44rem" },
  headerActions: { display: "flex", gap: "0.8rem", alignItems: "center" },
  rolePill: { display: "inline-flex", alignItems: "center", padding: "0.55rem 0.9rem", borderRadius: "999px", background: "#13283b", color: "#fff", fontSize: "0.85rem", textTransform: "capitalize" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" },
  statCard: { padding: "1.2rem", borderRadius: "1.1rem", background: "rgba(255,255,255,0.78)", border: "1px solid rgba(19,40,59,0.1)" },
  statValue: { fontSize: "2rem", color: "#13283b", fontWeight: 800 },
  statLabel: { color: "#5d7385", marginTop: "0.25rem" },
  workspace: { display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.25rem", alignItems: "start" },
  employeeWorkspace: { display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" },
  editorPanel: { display: "grid", gap: "1rem", padding: "1.4rem", borderRadius: "1.25rem", background: "rgba(255,255,255,0.82)", border: "1px solid rgba(19,40,59,0.1)", boxShadow: "0 18px 40px rgba(19,40,59,0.06)" },
  listPanel: { padding: "1.4rem", borderRadius: "1.25rem", background: "rgba(255,255,255,0.82)", border: "1px solid rgba(19,40,59,0.1)", boxShadow: "0 18px 40px rgba(19,40,59,0.06)" },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" },
  panelTitle: { fontSize: "1.15rem", fontWeight: 800, color: "#13283b" },
  reviewChip: { padding: "0.45rem 0.8rem", borderRadius: "999px", background: "#ece4ff", color: "#5d44c1", fontWeight: 700, fontSize: "0.85rem" },
  emptyState: { padding: "2rem", textAlign: "center", color: "#5d7385", border: "1px dashed #c3d0d8", borderRadius: "1rem" },
  todoList: { display: "grid", gap: "1rem" },
  todoCard: { padding: "1.15rem", borderRadius: "1rem", background: "#fff", border: "1px solid rgba(19,40,59,0.1)" },
  todoTop: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" },
  todoTitle: { margin: 0, color: "#13283b", fontSize: "1.1rem" },
  metaRow: { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.35rem" },
  metaText: { color: "#62798b", fontSize: "0.9rem" },
  statusBadge: { padding: "0.45rem 0.7rem", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" },
  todoDescription: { margin: "0.9rem 0", color: "#42586b", lineHeight: 1.55 },
  todoBottom: { display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  priorityPill: { display: "inline-flex", padding: "0.4rem 0.7rem", borderRadius: "999px", background: "#f1e3c7", color: "#7b5f20", fontWeight: 700, fontSize: "0.82rem" },
  noteBlock: { marginTop: "1rem", padding: "0.95rem", borderRadius: "0.9rem", background: "#f6f7fb", border: "1px solid #dce4ec" },
  feedbackBlock: { marginTop: "1rem", padding: "0.95rem", borderRadius: "0.9rem", background: "#fff1f1", border: "1px solid #f2cfcf" },
  noteTitle: { fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#42586b", marginBottom: "0.35rem" },
  noteText: { color: "#32475a", lineHeight: 1.5 },
  actionPanel: { display: "grid", gap: "0.8rem", marginTop: "1rem" },
  todoActions: { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  toastSuccess: { position: "fixed", right: "1.25rem", bottom: "1.25rem", padding: "0.95rem 1.1rem", borderRadius: "1rem", background: "#1f6d42", color: "#fff", boxShadow: "0 12px 30px rgba(31,109,66,0.24)" },
  toastError: { position: "fixed", right: "1.25rem", bottom: "1.25rem", padding: "0.95rem 1.1rem", borderRadius: "1rem", background: "#b94444", color: "#fff", boxShadow: "0 12px 30px rgba(185,68,68,0.24)" },
};
