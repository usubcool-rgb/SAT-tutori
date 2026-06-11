#!/usr/bin/env python3
"""
SAT Tutor GUI – English & Math (with mastery‑based avoidance)
- Avoids repeating questions you have answered correctly (mastered)
- Within a session, no repeats
- Full progress log and review
"""

import os
import sys
import json
import random
import threading
import time
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, simpledialog, Menu, Toplevel
from datetime import datetime
from typing import Dict, List, Set
import hashlib

import pandas as pd
from langchain_groq import ChatGroq

# -------------------- Base directory --------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    except NameError:
        BASE_DIR = os.getcwd()

CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
DB_FILE = os.path.join(BASE_DIR, "sat_database.json")

ENGLISH_LOG = os.path.join(BASE_DIR, "sat_english_progress.json")
MATH_LOG = os.path.join(BASE_DIR, "sat_math_progress.json")
ENGLISH_STATS = os.path.join(BASE_DIR, "sat_english_stats.json")
MATH_STATS = os.path.join(BASE_DIR, "sat_math_stats.json")

DEFAULT_CONFIG = {
    "groq_api_key": "",
    "temperature": 0.7,
    "font_size": "medium",
    "english_difficulty": "Medium",
    "math_difficulty": "Medium",
    "english_question_count": 10,
    "math_question_count": 10,
    "target_date": "2026-06-01"
}

# -------------------- Load database --------------------
if not os.path.exists(DB_FILE):
    messagebox.showerror("Missing Database", "sat_database.json not found.")
    sys.exit(1)

with open(DB_FILE, "r", encoding="utf-8") as f:
    FULL_DB = json.load(f)

QUESTION_BY_ID = {q.get("id"): q for q in FULL_DB if q.get("id")}

ENGLISH_QUESTIONS = [q for q in FULL_DB if q.get("subject") == "english"]
MATH_QUESTIONS = [q for q in FULL_DB if q.get("subject") == "math"]

# -------------------- Config & API --------------------
def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            for k, v in DEFAULT_CONFIG.items():
                if k not in config:
                    config[k] = v
            return config
    return DEFAULT_CONFIG.copy()

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

config = load_config()
if not config.get("groq_api_key"):
    root = tk.Tk()
    root.withdraw()
    key = simpledialog.askstring("API Key Required",
                                  "Enter your Groq API key:\n(Get from https://console.groq.com)",
                                  parent=None)
    root.destroy()
    if not key:
        sys.exit(1)
    config["groq_api_key"] = key
    save_config(config)

GROQ_API_KEY = config["groq_api_key"]

# -------------------- Groq helper --------------------
def get_groq_explanation(question_data, user_answer):
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.5, groq_api_key=GROQ_API_KEY)
    prompt = f"""
You are an SAT tutor. The student answered a question. Provide a short, encouraging explanation.

Question: {question_data['question']}
Options: {question_data['options']}
Correct answer: {question_data['correct']}
Student's answer: {user_answer}

Explain why the correct answer is right and why the student's answer is wrong (if applicable).
Be concise (max 4 sentences).
"""
    response = llm.invoke(prompt)
    return response.content

# -------------------- Progress logging --------------------
def load_progress(log_file):
    try:
        with open(log_file, 'r') as f:
            return json.load(f)
    except:
        return []

def save_progress(log_file, progress):
    with open(log_file, 'w') as f:
        json.dump(progress, f, indent=2)

def update_stats(stats_file, topic, correct):
    stats = {}
    try:
        with open(stats_file, 'r') as f:
            stats = json.load(f)
    except:
        pass
    if topic not in stats:
        stats[topic] = {"correct": 0, "incorrect": 0}
    if correct:
        stats[topic]["correct"] += 1
    else:
        stats[topic]["incorrect"] += 1
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

def get_weak_topics(stats_file):
    try:
        with open(stats_file, 'r') as f:
            stats = json.load(f)
        weak = []
        for topic, data in stats.items():
            total = data["correct"] + data["incorrect"]
            if total > 0 and data["incorrect"] / total > 0.5:
                weak.append((topic, data["incorrect"]))
        weak.sort(key=lambda x: x[1], reverse=True)
        return [w[0] for w in weak]
    except:
        return []

# -------------------- Question selection with mastery avoidance --------------------
def select_questions(subject, difficulty, count, mastered_ids, used_in_session_ids):
    """
    Returns a list of selected questions.
    - mastered_ids: questions already answered correctly (excluded if possible)
    - used_in_session_ids: already used in this session (excluded)
    - If not enough new questions, falls back to mastered ones.
    """
    if subject == "english":
        candidates = ENGLISH_QUESTIONS
    else:
        candidates = MATH_QUESTIONS

    # Filter by difficulty
    filtered = [q for q in candidates if q.get("difficulty", "medium").lower() == difficulty.lower()]
    if len(filtered) < count:
        filtered = candidates  # fallback to all difficulties

    # First, exclude mastered and already used this session
    available = [q for q in filtered if q.get("id") not in mastered_ids and q.get("id") not in used_in_session_ids]
    if len(available) >= count:
        return random.sample(available, count)
    else:
        # Not enough unmastered questions – allow some mastered ones (but exclude current session repeats)
        print(f"Warning: Only {len(available)} unmastered questions. Adding {count - len(available)} mastered ones.")
        mastered_available = [q for q in filtered if q.get("id") in mastered_ids and q.get("id") not in used_in_session_ids]
        combined = available + mastered_available
        if len(combined) >= count:
            return random.sample(combined, count)
        else:
            # Still not enough – take all combined (may include duplicates across sessions but not within session)
            return combined

# -------------------- Font sizes --------------------
class FontSizes:
    small = {"default": 10, "title": 14, "question": 11, "passage": 10}
    medium = {"default": 12, "title": 18, "question": 13, "passage": 11}
    large = {"default": 14, "title": 22, "question": 15, "passage": 13}

# -------------------- Settings Dialog --------------------
class SettingsDialog(Toplevel):
    def __init__(self, parent, current_config):
        super().__init__(parent)
        self.title("Settings")
        self.geometry("500x700")
        self.resizable(False, False)
        self.config = current_config.copy()
        self.result = None

        main = ttk.Frame(self, padding="10")
        main.pack(fill=tk.BOTH, expand=True)

        notebook = ttk.Notebook(main)
        notebook.pack(fill=tk.BOTH, expand=True)

        # General tab
        gen = ttk.Frame(notebook, padding="5")
        notebook.add(gen, text="General")
        row = 0
        ttk.Label(gen, text="Groq API Key:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.key_var = tk.StringVar(value=self.config.get("groq_api_key", ""))
        ttk.Entry(gen, textvariable=self.key_var, width=45, show="*").grid(row=row, column=1, pady=5)
        row += 1
        ttk.Label(gen, text="Font Size:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.font_var = tk.StringVar(value=self.config.get("font_size", "medium"))
        ttk.Combobox(gen, textvariable=self.font_var, values=["small","medium","large"], state="readonly").grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(gen, text="Temperature (0.0-1.5):").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.temp_var = tk.DoubleVar(value=self.config.get("temperature", 0.7))
        scale = ttk.Scale(gen, from_=0.0, to=1.5, variable=self.temp_var, orient=tk.HORIZONTAL, length=200)
        scale.grid(row=row, column=1, sticky=tk.W, pady=5)
        self.temp_label = ttk.Label(gen, text=f"{self.temp_var.get():.2f}")
        self.temp_label.grid(row=row, column=2, padx=5)
        scale.configure(command=lambda v: self.temp_label.config(text=f"{float(v):.2f}"))
        row += 1
        ttk.Label(gen, text="Target Exam Date (YYYY-MM-DD):").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.target_var = tk.StringVar(value=self.config.get("target_date", "2026-06-01"))
        ttk.Entry(gen, textvariable=self.target_var, width=15).grid(row=row, column=1, sticky=tk.W)

        # English tab
        eng = ttk.Frame(notebook, padding="5")
        notebook.add(eng, text="English")
        row = 0
        ttk.Label(eng, text="Difficulty:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.eng_diff = tk.StringVar(value=self.config.get("english_difficulty", "Medium"))
        ttk.Combobox(eng, textvariable=self.eng_diff, values=["Easy","Medium","Hard"], state="readonly").grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(eng, text="Questions per session:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.eng_count = tk.IntVar(value=self.config.get("english_question_count", 10))
        ttk.Spinbox(eng, from_=1, to=30, textvariable=self.eng_count, width=5).grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(eng, text="Progress log file:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.eng_log = tk.StringVar(value=os.path.basename(ENGLISH_LOG))
        ttk.Entry(eng, textvariable=self.eng_log, width=30).grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(eng, text="Stats file:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.eng_stats = tk.StringVar(value=os.path.basename(ENGLISH_STATS))
        ttk.Entry(eng, textvariable=self.eng_stats, width=30).grid(row=row, column=1, sticky=tk.W)

        # Math tab
        math = ttk.Frame(notebook, padding="5")
        notebook.add(math, text="Math")
        row = 0
        ttk.Label(math, text="Difficulty:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.math_diff = tk.StringVar(value=self.config.get("math_difficulty", "Medium"))
        ttk.Combobox(math, textvariable=self.math_diff, values=["Easy","Medium","Hard"], state="readonly").grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(math, text="Questions per session:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.math_count = tk.IntVar(value=self.config.get("math_question_count", 10))
        ttk.Spinbox(math, from_=1, to=30, textvariable=self.math_count, width=5).grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(math, text="Progress log file:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.math_log = tk.StringVar(value=os.path.basename(MATH_LOG))
        ttk.Entry(math, textvariable=self.math_log, width=30).grid(row=row, column=1, sticky=tk.W)
        row += 1
        ttk.Label(math, text="Stats file:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.math_stats = tk.StringVar(value=os.path.basename(MATH_STATS))
        ttk.Entry(math, textvariable=self.math_stats, width=30).grid(row=row, column=1, sticky=tk.W)

        # Buttons
        btn_frame = ttk.Frame(main)
        btn_frame.pack(pady=10)
        ttk.Button(btn_frame, text="Save", command=self.save).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Cancel", command=self.destroy).pack(side=tk.LEFT, padx=5)

    def save(self):
        try:
            datetime.strptime(self.target_var.get(), "%Y-%m-%d")
        except ValueError:
            messagebox.showerror("Invalid Date", "Target date must be YYYY-MM-DD")
            return
        self.config["groq_api_key"] = self.key_var.get()
        self.config["font_size"] = self.font_var.get()
        self.config["temperature"] = self.temp_var.get()
        self.config["target_date"] = self.target_var.get()
        self.config["english_difficulty"] = self.eng_diff.get()
        self.config["english_question_count"] = self.eng_count.get()
        self.config["math_difficulty"] = self.math_diff.get()
        self.config["math_question_count"] = self.math_count.get()
        global ENGLISH_LOG, MATH_LOG, ENGLISH_STATS, MATH_STATS
        ENGLISH_LOG = os.path.join(BASE_DIR, self.eng_log.get())
        MATH_LOG = os.path.join(BASE_DIR, self.math_log.get())
        ENGLISH_STATS = os.path.join(BASE_DIR, self.eng_stats.get())
        MATH_STATS = os.path.join(BASE_DIR, self.math_stats.get())
        self.result = self.config
        self.destroy()

# -------------------- Main GUI --------------------
class SATutorGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("SAT Tutor – Mastery-Based Practice")
        self.geometry("1050x850")
        self.minsize(900, 650)
        self.configure(bg="#f0f0f0")

        self.current_font = config.get("font_size", "medium")
        self.font = FontSizes.__dict__[self.current_font]
        self.subject = "english"
        self.current_questions = []
        self.current_index = 0
        self.session_results = []
        self.used_in_session_ids = set()  # to avoid repeats within the same session
        self.mastered_ids = set()        # questions answered correctly (global)

        self.build_ui()
        self.load_mastered_questions()
        self.update_days_left()

    def build_ui(self):
        # Main frame
        self.main = ttk.Frame(self, padding="10")
        self.main.pack(fill=tk.BOTH, expand=True)

        # Top bar
        top = ttk.Frame(self.main)
        top.pack(fill=tk.X, pady=5)
        ttk.Label(top, text="Subject:", font=("Helvetica", self.font["default"])).pack(side=tk.LEFT, padx=5)
        self.eng_btn = tk.Button(top, text="English (R&W)", command=lambda: self.set_subject("english"),
                                 font=("Helvetica", self.font["default"]), bg="#f0f0f0")
        self.eng_btn.pack(side=tk.LEFT, padx=5)
        self.math_btn = tk.Button(top, text="Math", command=lambda: self.set_subject("math"),
                                  font=("Helvetica", self.font["default"]), bg="#f0f0f0")
        self.math_btn.pack(side=tk.LEFT, padx=5)
        self.days_label = ttk.Label(top, font=("Helvetica", self.font["default"]))
        self.days_label.pack(side=tk.RIGHT, padx=10)

        # Buttons row
        btn_row = ttk.Frame(self.main)
        btn_row.pack(fill=tk.X, pady=5)
        self.start_btn = ttk.Button(btn_row, text="Start Session", command=self.start_session)
        self.start_btn.pack(side=tk.LEFT, padx=2)
        self.weak_btn = ttk.Button(btn_row, text="Weak Topics", command=self.show_weak_topics)
        self.weak_btn.pack(side=tk.LEFT, padx=2)
        self.review_btn = ttk.Button(btn_row, text="Review History", command=self.review_history)
        self.review_btn.pack(side=tk.LEFT, padx=2)

        # Practice area
        self.qframe = ttk.LabelFrame(self.main, text="Practice Area", padding="10")
        self.qframe.pack(fill=tk.BOTH, expand=True, pady=10)

        self.passage = scrolledtext.ScrolledText(self.qframe, wrap=tk.WORD, height=10,
                                                 font=("Helvetica", self.font["passage"]))
        self.passage.pack(fill=tk.BOTH, expand=True, pady=5)

        self.q_label = ttk.Label(self.qframe, wraplength=800, font=("Helvetica", self.font["question"]))
        self.q_label.pack(pady=5, anchor=tk.W)

        # Answer choices with automatic letter formatting
        options_frame = ttk.LabelFrame(self.qframe, text="Answer Choices", padding="5")
        options_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.listbox = tk.Listbox(options_frame, font=("Helvetica", self.font["default"]),
                                  selectmode=tk.SINGLE, exportselection=False,
                                  bg="white", activestyle="none")
        scrollbar = ttk.Scrollbar(options_frame, orient=tk.VERTICAL, command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Buttons
        self.submit_btn = ttk.Button(self.qframe, text="Submit Answer", command=self.submit_answer)
        self.submit_btn.pack(pady=10)

        self.feedback = scrolledtext.ScrolledText(self.qframe, wrap=tk.WORD, height=6,
                                                  font=("Helvetica", self.font["default"]), state=tk.DISABLED)
        self.feedback.pack(fill=tk.X, pady=5)

        self.next_btn = ttk.Button(self.qframe, text="Next Question", command=self.next_question, state=tk.DISABLED)
        self.next_btn.pack(side=tk.RIGHT, padx=5)

        self.status_var = tk.StringVar(value="Ready.")
        status_bar = ttk.Label(self.main, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(fill=tk.X, side=tk.BOTTOM, pady=2)

        # Menu
        menubar = Menu(self)
        self.config(menu=menubar)
        settings_menu = Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Settings", menu=settings_menu)
        settings_menu.add_command(label="Preferences", command=self.open_settings)

        self.disable_question_area()
        self.set_subject(self.subject)

    def format_option(self, text, index):
        letters = ["A", "B", "C", "D"]
        expected_prefix = f"{letters[index]})"
        if text.strip().startswith(expected_prefix):
            return text
        import re
        cleaned = re.sub(r'^[A-D]\)\s*', '', text)
        return f"{expected_prefix} {cleaned.strip()}"

    def set_subject(self, subj):
        self.subject = subj
        if subj == "english":
            self.eng_btn.config(relief=tk.SUNKEN)
            self.math_btn.config(relief=tk.RAISED)
            self.qframe.config(text="Practice Area – English (Reading & Writing)")
        else:
            self.eng_btn.config(relief=tk.RAISED)
            self.math_btn.config(relief=tk.SUNKEN)
            self.qframe.config(text="Practice Area – Math")
        self.disable_question_area()
        self.status_var.set(f"Subject: {subj.upper()}. Click 'Start Session'.")

    def open_settings(self):
        diag = SettingsDialog(self, config)
        self.wait_window(diag)
        if diag.result:
            config.update(diag.result)
            save_config(config)
            self.current_font = config["font_size"]
            self.font = FontSizes.__dict__[self.current_font]
            messagebox.showinfo("Restart Required", "Font changes require restart.")
            self.update_days_left()

    def update_days_left(self):
        try:
            target = datetime.strptime(config["target_date"], "%Y-%m-%d")
        except:
            target = datetime(2026, 6, 1)
        days = (target - datetime.now()).days
        if days > 0:
            self.days_label.config(text=f"📅 {days} days left")
        else:
            self.days_label.config(text="🎉 Exam passed!")

    def disable_question_area(self):
        self.passage.config(state=tk.DISABLED)
        self.q_label.config(text="")
        self.listbox.delete(0, tk.END)
        self.submit_btn.config(state=tk.DISABLED)
        self.next_btn.config(state=tk.DISABLED)
        self.feedback.config(state=tk.NORMAL)
        self.feedback.delete(1.0, tk.END)
        self.feedback.config(state=tk.DISABLED)

    def enable_question_area(self):
        self.passage.config(state=tk.NORMAL)
        self.passage.delete(1.0, tk.END)
        self.submit_btn.config(state=tk.NORMAL)
        self.next_btn.config(state=tk.DISABLED)

    def load_mastered_questions(self):
        """Load IDs of questions that have been answered correctly from logs."""
        eng_prog = load_progress(ENGLISH_LOG)
        math_prog = load_progress(MATH_LOG)
        for entry in eng_prog + math_prog:
            if entry.get("is_correct", False):
                self.mastered_ids.add(entry.get("question_id"))

    def start_session(self):
        self.disable_question_area()
        self.session_results = []
        self.current_questions = []
        self.used_in_session_ids.clear()

        count = config[f"{self.subject}_question_count"]
        difficulty = config[f"{self.subject}_difficulty"]

        # Select questions, avoiding mastered ones as much as possible
        new_qs = select_questions(self.subject, difficulty, count,
                                   self.mastered_ids, self.used_in_session_ids)
        if not new_qs:
            messagebox.showinfo("No questions", "No questions available. Check database.")
            return

        self.current_questions = new_qs
        self.current_index = 0
        self.enable_question_area()
        self.show_question()

    def show_question(self):
        if self.current_index >= len(self.current_questions):
            self.end_session()
            return
        q = self.current_questions[self.current_index]
        self.passage.config(state=tk.NORMAL)
        self.passage.delete(1.0, tk.END)
        if q.get("passage"):
            self.passage.insert(tk.END, q["passage"])
        self.q_label.config(text=q["question"])
        self.passage.config(state=tk.DISABLED)

        self.listbox.delete(0, tk.END)
        options = q.get("options", [])
        for i, opt in enumerate(options):
            formatted = self.format_option(opt, i)
            self.listbox.insert(tk.END, formatted)

        self.submit_btn.config(state=tk.NORMAL)
        self.next_btn.config(state=tk.DISABLED)
        self.feedback.config(state=tk.NORMAL)
        self.feedback.delete(1.0, tk.END)
        self.feedback.config(state=tk.DISABLED)

    def submit_answer(self):
        selected = self.listbox.curselection()
        if not selected:
            messagebox.showwarning("No answer", "Please select an answer.")
            return
        selected_text = self.listbox.get(selected[0])
        user_letter = selected_text[0].upper()
        q = self.current_questions[self.current_index]
        correct_letter = q["correct"].upper()
        is_correct = (user_letter == correct_letter)

        # Record the answer with a snapshot
        entry = {
            "timestamp": datetime.now().isoformat(),
            "question_id": q.get("id", "unknown"),
            "topic": q.get("topic", "unknown"),
            "user_answer": user_letter,
            "correct": correct_letter,
            "is_correct": is_correct,
            "snapshot": {
                "question": q["question"],
                "passage": q.get("passage", ""),
                "options": q["options"],
                "explanation": q.get("explanation", "")
            }
        }
        self.session_results.append(entry)

        # Save to log file
        log_file = ENGLISH_LOG if self.subject == "english" else MATH_LOG
        prog = load_progress(log_file)
        prog.append(entry)
        save_progress(log_file, prog)

        # If correct, add to mastered IDs (so future sessions avoid it)
        if is_correct:
            self.mastered_ids.add(q.get("id"))

        # Mark as used in this session
        self.used_in_session_ids.add(q.get("id"))

        # Update stats (weak topics)
        stats_file = ENGLISH_STATS if self.subject == "english" else MATH_STATS
        update_stats(stats_file, entry["topic"], is_correct)

        # Get Groq explanation
        explanation = get_groq_explanation(q, user_letter)

        self.feedback.config(state=tk.NORMAL)
        self.feedback.delete(1.0, tk.END)
        self.feedback.insert(tk.END, f"Your answer: {user_letter}\nCorrect answer: {correct_letter}\n\n{explanation}")
        self.feedback.config(state=tk.DISABLED)
        self.submit_btn.config(state=tk.DISABLED)
        self.next_btn.config(state=tk.NORMAL)

    def next_question(self):
        self.current_index += 1
        self.show_question()

    def end_session(self):
        total = len(self.session_results)
        correct = sum(1 for r in self.session_results if r["is_correct"])
        score_pct = (correct / total * 100) if total > 0 else 0
        self.feedback.config(state=tk.NORMAL)
        self.feedback.delete(1.0, tk.END)
        self.feedback.insert(tk.END, f"Session finished! Score: {correct}/{total} = {score_pct:.1f}%\n\nWell done!")
        self.feedback.config(state=tk.DISABLED)
        self.disable_question_area()
        self.status_var.set(f"Session finished. Score: {correct}/{total}")

    def show_weak_topics(self):
        stats_file = ENGLISH_STATS if self.subject == "english" else MATH_STATS
        weak = get_weak_topics(stats_file)
        if not weak:
            messagebox.showinfo("Weak Topics", "No weak topics yet.")
        else:
            messagebox.showinfo("Weak Topics", "Topics you struggle with:\n- " + "\n- ".join(weak))

    def review_history(self):
        log_file = ENGLISH_LOG if self.subject == "english" else MATH_LOG
        prog = load_progress(log_file)
        if not prog:
            messagebox.showinfo("History", "No history yet for this subject.")
            return

        review_win = tk.Toplevel(self)
        review_win.title(f"{self.subject.upper()} Practice History")
        review_win.geometry("900x700")
        review_win.configure(bg="#f0f0f0")

        left_frame = ttk.Frame(review_win)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        ttk.Label(left_frame, text="Answered Questions", font=("Helvetica", 12, "bold")).pack(pady=2)
        listbox = tk.Listbox(left_frame, font=("Helvetica", 10))
        listbox.pack(fill=tk.BOTH, expand=True)

        right_frame = ttk.Frame(review_win)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        details_text = scrolledtext.ScrolledText(right_frame, wrap=tk.WORD, font=("Helvetica", 10))
        details_text.pack(fill=tk.BOTH, expand=True)

        for idx, entry in enumerate(prog):
            dt = entry["timestamp"][:16]
            topic = entry.get("topic", "unknown")
            mark = "✅" if entry["is_correct"] else "❌"
            display = f"{mark} {dt} | {topic}"
            listbox.insert(tk.END, display)

        def on_select(event):
            sel = listbox.curselection()
            if not sel:
                return
            entry = prog[sel[0]]
            if "snapshot" in entry:
                qdata = entry["snapshot"]
            else:
                qdata = QUESTION_BY_ID.get(entry["question_id"], {})
            details_text.delete(1.0, tk.END)
            details_text.insert(tk.END, f"Timestamp: {entry['timestamp']}\n")
            details_text.insert(tk.END, f"Topic: {entry.get('topic', 'unknown')}\n")
            details_text.insert(tk.END, f"Your answer: {entry['user_answer']}\n")
            details_text.insert(tk.END, f"Correct answer: {entry['correct']}\n\n")
            details_text.insert(tk.END, "Passage:\n")
            details_text.insert(tk.END, qdata.get("passage", "") + "\n\n")
            details_text.insert(tk.END, "Question:\n")
            details_text.insert(tk.END, qdata.get("question", "") + "\n\n")
            details_text.insert(tk.END, "Answer choices:\n")
            for opt in qdata.get("options", []):
                details_text.insert(tk.END, f"  {opt}\n")
            details_text.insert(tk.END, "\nExplanation:\n")
            details_text.insert(tk.END, qdata.get("explanation", "No explanation available."))

        listbox.bind('<<ListboxSelect>>', on_select)
        if prog:
            listbox.selection_set(0)
            on_select(None)

        ttk.Button(review_win, text="Close", command=review_win.destroy).pack(pady=5)

if __name__ == "__main__":
    try:
        import langchain_groq
    except ImportError:
        messagebox.showerror("Missing Package", "Please install langchain-groq: pip install langchain-groq")
        sys.exit(1)
    app = SATutorGUI()
    app.mainloop()
