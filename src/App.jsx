import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

import { 
  CheckCircle2, Circle, Trash2, Plus, Clock, Settings, RefreshCw, 
  AlertCircle, Sparkles, Server, Check, X, Search, Edit2, 
  ArrowUpDown, LogOut, User as UserIcon, Lock, Mail, ArrowRight
} from 'lucide-react';


const getInitialApiUrl = () => {
  // Check for Vite environment variables first
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback for Create React App or Node environments
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Default fallback for local development
  return 'http://localhost:5000';
};

export default function App() {
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('taskflow_token') || null);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('taskflow_user') || null);
  const [isAuthMode, setIsAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Todo State
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [filter, setFilter] = useState('all'); 
  const [sortBy, setSortBy] = useState('newest'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Settings & Network State
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingApiUrl, setPendingApiUrl] = useState(getInitialApiUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    const endpoint = isAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      setCurrentUser(data.email);
      localStorage.setItem('taskflow_token', data.token);
      localStorage.setItem('taskflow_user', data.email);
      setAuthPassword('');
      setAuthEmail('');
      setIsConnected(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setTodos([]);
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  };

  const fetchTodos = async (targetUrl = apiUrl) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${targetUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
      }

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTodos(data);
      setIsConnected(true);
    } catch (err) {
      console.warn('Backend issue:', err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTodos(apiUrl);
  }, [apiUrl, token]);

  const handleAddTodo = async (e) => {
    e.preventDefault();
    const trimmed = newTodoText.trim();
    if (!trimmed) return;

    const tempId = `local-${Date.now()}`;
    const newTodo = { _id: tempId, text: trimmed, completed: false, createdAt: new Date().toISOString() };
    setTodos((prev) => [newTodo, ...prev]);
    setNewTodoText('');

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to create on server');
      
      const savedTodo = await response.json();
      setTodos((prev) => prev.map((t) => (t._id === tempId ? savedTodo : t)));
    } catch (err) {
      console.error('Error saving todo:', err);
      // Remove temp item on failure
      setTodos((prev) => prev.filter((t) => t._id !== tempId));
    }
  };

  const handleToggleTodo = async (todo) => {
    const updatedStatus = !todo.completed;
    setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: updatedStatus } : t)));

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${todo._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ completed: updatedStatus }),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: todo.completed } : t)));
    }
  };

  const handleStartEdit = (todo) => {
    setEditingId(todo._id);
    setEditingText(todo.text);
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    const previousTodos = [...todos];
    setTodos((prev) => prev.map((t) => t._id === id ? { ...t, text: trimmed, updatedAt: new Date().toISOString() } : t));
    setEditingId(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });
      if (response.status === 401) handleLogout();
      if (!response.ok) throw new Error('Update failed');
    } catch (err) {
      setTodos(previousTodos);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    const targetId = deleteCandidate._id;
    setTodos((prev) => prev.filter((t) => t._id !== targetId));
    setDeleteCandidate(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${targetId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const formatDateTime = (isoDate) => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  const filteredTodos = useMemo(() => {
    const result = todos.filter((todo) => {
      const matchesFilter = filter === 'all' ? true : filter === 'active' ? !todo.completed : todo.completed;
      const matchesSearch = todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (sortBy === 'az') return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'za') return b.text.localeCompare(a.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'status') return Number(a.completed) - Number(b.completed);
      return 0;
    });
  }, [todos, filter, searchQuery, sortBy]);

  if (!token) {
    return (
      <div className="app-shell auth-shell">
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="API Configuration"
          className="settings-trigger"
          aria-label="API Configuration"
        >
          <Settings className="w-5 h-5" />
        </button>

        <main className="auth-layout">
          <section className="auth-visual" aria-label="TaskFlow product preview">
            <div className="visual-glow visual-glow-one" />
            <div className="visual-glow visual-glow-two" />
            <div className="visual-brand">
              <span className="visual-brand-icon"><Sparkles className="w-5 h-5" /></span>
              <span>TaskFlow</span>
            </div>

            <div className="visual-copy">
              <span className="eyebrow"><span /> Focus on what matters</span>
              <h2>Make space for<br /><em>your best work.</em></h2>
              <p>One calm place to capture, prioritize, and complete every task.</p>
            </div>

            <div className="preview-window">
              <div className="preview-bar">
                <span /><span /><span />
                <div>Today&apos;s focus</div>
              </div>
              <div className="preview-content">
                <div className="preview-heading">
                  <div><strong>Good morning</strong><small>Keep moving forward</small></div>
                  <span>12%</span>
                </div>
                <div className="preview-task preview-task-done"><CheckCircle2 className="w-4 h-4" /><span>Review project notes</span></div>
                <div className="preview-task"><Circle className="w-4 h-4" /><span>Plan weekly priorities</span></div>
                <div className="preview-task"><Circle className="w-4 h-4" /><span>Send progress update</span></div>
                <div className="preview-progress"><span /></div>
              </div>
            </div>

            <div className="visual-footer">
              <span><CheckCircle2 className="w-4 h-4" /> Secure by design</span>
              <span><RefreshCw className="w-4 h-4" /> Always in sync</span>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-card">
              <div className="auth-brand">
                <div className="auth-brand-icon"><Sparkles className="w-8 h-8 text-white" /></div>
              </div>
              <span className="auth-kicker">{isAuthMode === 'login' ? 'Welcome back' : 'Start your journey'}</span>
              <h1 className="auth-title">{isAuthMode === 'login' ? 'Sign in to TaskFlow' : 'Create your account'}</h1>
              <p className="auth-subtitle">
                {isAuthMode === 'login' ? 'Enter your details to continue where you left off.' : 'Build a calmer, more productive routine from day one.'}
              </p>

              <form onSubmit={handleAuth} className="auth-form">
                {authError && (
                  <div className="auth-error">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}
                <div className="auth-field">
                  <Mail className="auth-field-icon" />
                  <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email address" className="auth-input" autoComplete="email" />
                </div>
                <div className="auth-field">
                  <Lock className="auth-field-icon" />
                  <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" className="auth-input" autoComplete={isAuthMode === 'login' ? 'current-password' : 'new-password'} />
                </div>
                <button type="submit" disabled={isAuthLoading} className="auth-button">
                  {isAuthLoading ? 'Please wait...' : (isAuthMode === 'login' ? 'Sign in' : 'Create account')}
                  {!isAuthLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <div className="auth-switch">
                <span>{isAuthMode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
                <button onClick={() => setIsAuthMode(isAuthMode === 'login' ? 'register' : 'login')} className="auth-switch-button">
                  {isAuthMode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </div>

              <div className="security-note"><Lock className="w-3.5 h-3.5" /> Your session is protected with JWT authentication</div>
            </div>
          </section>
        </main>

        {/* Re-use Settings Modal Logic */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" /> API Environment Settings
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-300">Backend URL</label>
                <input
                  type="text"
                  value={pendingApiUrl}
                  onChange={(e) => setPendingApiUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800">Cancel</button>
                <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell dashboard-shell">
      <div className="dashboard-frame">
        
        <header className="topbar">
          <div className="topbar-brand">
            <div className="brand-mark">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="brand-title">TaskFlow</h1>
              <p className="brand-caption">Your day, beautifully organized</p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="connection-pill" data-connected={isConnected}>
              <span className="connection-dot" />
              {isConnected ? 'Synced' : 'Offline'}
            </div>
            <button onClick={() => fetchTodos(apiUrl)} title="Refresh" className="icon-button" aria-label="Refresh tasks">
              <RefreshCw className={isLoading ? 'spin-icon' : ''} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} title="Settings" className="icon-button" aria-label="Settings">
              <Settings className="w-4 h-4" />
            </button>
          </div>
          
          <div className="user-row">
            <div className="user-details">
              <UserIcon className="w-4 h-4" />
              <span>Signed in as <strong>{currentUser}</strong></span>
            </div>
            <button onClick={handleLogout} className="logout-button">
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <form onSubmit={handleAddTodo} className="task-composer">
          <div className="composer-field">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="What needs to be done today?..."
              className="composer-input"
              aria-label="New task"
            />
            <button type="submit" disabled={!newTodoText.trim()} className="add-task-button">
              <Plus className="w-4 h-4" /> <span>Add task</span>
            </button>
          </div>
        </form>

        <div className="task-controls">
          <div className="filter-tabs" role="group" aria-label="Filter tasks">
            {['all', 'active', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`filter-tab ${filter === f ? 'filter-tab-active' : ''}`}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="control-group">
            <label className="sort-control">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort tasks">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="az">A &rarr; Z</option>
                <option value="za">Z &rarr; A</option>
                <option value="status">Pending first</option>
              </select>
            </label>
            <label className="search-control">
              <Search className="w-3.5 h-3.5" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks..." aria-label="Search tasks" />
            </label>
          </div>
        </div>

        <div className="task-list">
          {filteredTodos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><CheckCircle2 className="w-7 h-7" /></div>
              <h3>No tasks found</h3>
              <p>{searchQuery || filter !== 'all' ? 'Try changing your search or filter.' : 'Add your first task to get started.'}</p>
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const formattedDate = formatDateTime(todo.createdAt || todo.timestamp);
              const isEditing = editingId === todo._id;

              return (
                <article key={todo._id} className={`task-card ${todo.completed ? 'task-card-completed' : ''}`}>
                  <div className="task-main">
                    <button onClick={() => handleToggleTodo(todo)} disabled={isEditing} className="task-toggle" aria-label={todo.completed ? 'Mark as active' : 'Mark as completed'}>
                      {todo.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div className="task-content">
                      {isEditing ? (
                        <input
                          type="text" autoFocus value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(todo._id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="task-edit-input"
                          aria-label="Edit task"
                        />
                      ) : (
                        <p onDoubleClick={() => !todo.completed && handleStartEdit(todo)} className="task-text">
                          {todo.text}
                        </p>
                      )}
                      {formattedDate && !isEditing && (
                        <div className="task-date">
                          <Clock className="w-3 h-3" /> {formattedDate} {todo.updatedAt && '(edited)'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="task-actions">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(todo._id)} className="task-action save" aria-label="Save task"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="task-action" aria-label="Cancel edit"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(todo)} className="task-action" aria-label={`Edit ${todo.text}`}><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteCandidate(todo)} className="task-action delete" aria-label={`Delete ${todo.text}`}><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsSettingsOpen(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setIsSettingsOpen(false)} className="modal-close" aria-label="Close settings"><X className="w-5 h-5" /></button>
            <div className="modal-heading">
              <div className="modal-icon"><Server className="w-5 h-5" /></div>
              <div><h2 id="settings-title">API Settings</h2><p>Connect your Todo backend</p></div>
            </div>
            <label className="api-field">
              <span>Backend URL</span>
              <input type="text" value={pendingApiUrl} onChange={(e) => setPendingApiUrl(e.target.value)} placeholder="https://api.example.com" />
            </label>
            <div className="modal-actions">
              <button onClick={() => setIsSettingsOpen(false)} className="secondary-button">Cancel</button>
              <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="primary-button">Save connection</button>
            </div>
          </section>
        </div>
      )}

      {deleteCandidate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteCandidate(null)}>
          <section className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="delete-icon"><Trash2 className="w-5 h-5" /></div>
            <h2 id="delete-title">Delete task?</h2>
            <p>Remove “{deleteCandidate.text}” from your list?</p>
            <div className="modal-actions">
              <button onClick={() => setDeleteCandidate(null)} className="secondary-button">Keep task</button>
              <button onClick={confirmDelete} className="danger-button">Delete task</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}