(() => {
  const $ = (id) => document.getElementById(id);
  const expressionEl = $("expression");
  const resultEl = $("result");
  const statusEl = $("status");
  const memoryIndicator = $("memoryIndicator");
  const historyList = $("historyList");
  const historyCount = $("historyCount");
  const angleButton = $("angleMode");
  let expression = "";
  let lastAnswer = 0;
  let memory = null;
  let angleMode = "DEG";
  let history = [];
  let justEvaluated = false;
  let toastTimer;

  const pretty = (value) => {
    if (!Number.isFinite(value)) throw new Error("Result is not a finite number");
    if (Object.is(value, -0)) value = 0;
    if (Math.abs(value) >= 1e12 || (Math.abs(value) > 0 && Math.abs(value) < 1e-8)) {
      return value.toExponential(8).replace(/\.?0+e/, "e");
    }
    return Number(value.toPrecision(12)).toString();
  };
  const showToast = (message) => {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1900);
  };
  const setStatus = (message = "READY") => statusEl.textContent = message;
  const updateDisplay = () => {
    expressionEl.textContent = expression || "";
    memoryIndicator.textContent = memory === null ? "MEMORY EMPTY" : "MEMORY SET";
    resultEl.textContent = expression ? resultEl.textContent : pretty(lastAnswer);
  };
  const insert = (value) => {
    if (justEvaluated && /^[0-9.]$/.test(value)) expression = "";
    if (justEvaluated && /^(sin|cos|tan|asin|acos|atan|sqrt|log|ln|abs|10\^|π|e|Ans|\()/.test(value)) expression = "";
    justEvaluated = false;
    expression += value;
    expressionEl.textContent = expression;
    setStatus("EDITING");
  };
  const clear = () => {
    expression = "";
    resultEl.textContent = pretty(lastAnswer);
    expressionEl.textContent = "";
    justEvaluated = false;
    setStatus("READY");
  };
  const backspace = () => {
    expression = expression.slice(0, -1);
    expressionEl.textContent = expression;
    justEvaluated = false;
    setStatus("EDITING");
  };

  // A small parser avoids eval(), so calculator input is never executed as JavaScript.
  function tokenize(input) {
    const s = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const rest = s.slice(i);
      const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (number) { tokens.push({type:"number", value:Number(number[0])}); i += number[0].length; continue; }
      const identifier = rest.match(/^[a-zA-Z]+/);
      if (identifier) { tokens.push({type:"name", value:identifier[0]}); i += identifier[0].length; continue; }
      const ch = s[i];
      if ("+-*/^!()%".includes(ch)) { tokens.push({type:ch, value:ch}); i++; continue; }
      if (ch === "π") { tokens.push({type:"name",value:"pi"}); i++; continue; }
      throw new Error("Unexpected character: " + ch);
    }
    // Insert implicit multiplication: 2π, 2(3), and (2)(3).
    const out = [];
    for (let j=0; j<tokens.length; j++) {
      const a = out[out.length-1], b = tokens[j];
      if (a && ((a.type==="number" || a.type===")" || a.type==="!" || a.type==="%" || (a.type==="name" && ["pi","e","ans"].includes(a.value))) &&
          (b.type==="number" || b.type==="(" || b.type==="name"))) out.push({type:"*",value:"*"});
      out.push(b);
    }
    return out;
  }
  function evaluate(input) {
    const tokens = tokenize(input);
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];
    const expect = (type) => { if (!peek() || peek().type !== type) throw new Error("Check your expression"); return take(); };
    const fact = (n) => {
      if (n < 0 || !Number.isInteger(n)) throw new Error("Factorial needs a whole number ≥ 0");
      if (n > 170) throw new Error("Number is too large for factorial");
      let result = 1; for (let k=2;k<=n;k++) result*=k; return result;
    };
    const angleIn = (n) => angleMode === "DEG" ? n * Math.PI / 180 : n;
    const angleOut = (n) => angleMode === "DEG" ? n * 180 / Math.PI : n;
    function primary() {
      const t = peek();
      if (!t) throw new Error("Enter an expression");
      if (t.type === "+") { take(); return unary(); }
      if (t.type === "-") { take(); return -unary(); }
      if (t.type === "number") { take(); return t.value; }
      if (t.type === "(") { take(); const v = addSub(); expect(")"); return v; }
      if (t.type === "name") {
        take();
        const name = t.value.toLowerCase();
        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;
        if (name === "ans") return lastAnswer;
        const allowed = ["sin","cos","tan","asin","acos","atan","sqrt","log","ln","abs"];
        if (!allowed.includes(name)) throw new Error("Unknown function: " + name);
        expect("("); const v = addSub(); expect(")");
        switch(name) {
          case "sin": return Math.sin(angleIn(v));
          case "cos": return Math.cos(angleIn(v));
          case "tan": if (Math.abs(Math.cos(angleIn(v))) < 1e-12) throw new Error("Tangent is undefined here"); return Math.tan(angleIn(v));
          case "asin": return angleOut(Math.asin(v));
          case "acos": return angleOut(Math.acos(v));
          case "atan": return angleOut(Math.atan(v));
          case "sqrt": if(v<0) throw new Error("Square root needs a non-negative number"); return Math.sqrt(v);
          case "log": if(v<=0) throw new Error("Logarithm needs a positive number"); return Math.log10(v);
          case "ln": if(v<=0) throw new Error("Logarithm needs a positive number"); return Math.log(v);
          case "abs": return Math.abs(v);
        }
      }
      throw new Error("Check your expression");
    }
    function postfix() {
      let v = primary();
      while (peek() && (peek().type === "!" || peek().type === "%")) {
        const op = take().type;
        if (op === "!") v = fact(v);
        else v /= 100;
      }
      return v;
    }
    function power() {
      let v = postfix();
      if (peek() && peek().type === "^") { take(); v = Math.pow(v, unary()); }
      return v;
    }
    function unary() { return power(); }
    function mulDiv() {
      let v = unary();
      while (peek() && ["*","/"].includes(peek().type)) {
        const op = take().type, rhs = unary();
        if (op === "/" && rhs === 0) throw new Error("Cannot divide by zero");
        v = op === "*" ? v * rhs : v / rhs;
      }
      return v;
    }
    function addSub() {
      let v = mulDiv();
      while (peek() && ["+","-"].includes(peek().type)) {
        const op = take().type, rhs = mulDiv();
        v = op === "+" ? v + rhs : v - rhs;
      }
      return v;
    }
    const value = addSub();
    if (pos < tokens.length) throw new Error("Check your expression");
    if (!Number.isFinite(value)) throw new Error("Result is outside the supported range");
    return value;
  }
  function calculate() {
    if (!expression.trim()) return;
    try {
      const value = evaluate(expression);
      const formatted = pretty(value);
      history.unshift({expression, value:formatted, raw:value});
      history = history.slice(0, 12);
      lastAnswer = value;
      resultEl.textContent = formatted;
      expressionEl.textContent = expression + " =";
      expression = formatted;
      justEvaluated = true;
      setStatus("COMPLETE");
      renderHistory();
    } catch (err) {
      setStatus("CHECK INPUT");
      showToast(err.message || "Could not calculate that expression");
    }
  }
  function renderHistory() {
    historyCount.textContent = history.length;
    if (!history.length) {
      historyList.innerHTML = '<div class="empty-history"><span>↗</span><p>Your calculations will appear here.</p><small>Run a calculation to get started.</small></div>';
      return;
    }
    historyList.innerHTML = "";
    history.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "history-item";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", "Reuse result " + item.value);
      const left = document.createElement("div");
      const exp = document.createElement("div"); exp.className = "hist-expression"; exp.textContent = item.expression;
      const res = document.createElement("div"); res.className = "hist-result"; res.textContent = "= " + item.value;
      left.append(exp,res);
      const right = document.createElement("span"); right.className = "use-result"; right.textContent = "Use ↗";
      row.append(left,right);
      const use = () => { expression = item.value; resultEl.textContent = item.value; expressionEl.textContent = item.expression + " ="; justEvaluated = true; setStatus("HISTORY"); };
      row.addEventListener("click", use);
      row.addEventListener("keydown", (e) => { if(e.key==="Enter" || e.key===" ") {e.preventDefault();use();} });
      historyList.append(row);
    });
  }
  function currentValue() {
    if (!expression.trim()) return lastAnswer;
    return evaluate(expression);
  }
  function doAction(action) {
    try {
      switch(action) {
        case "clear": clear(); break;
        case "backspace": backspace(); break;
        case "equals": calculate(); break;
        case "sign":
          if (expression) expression = expression.startsWith("-(") && expression.endsWith(")") ? expression.slice(2,-1) : "-(" + expression + ")";
          else expression = "-";
          expressionEl.textContent = expression; justEvaluated = false; setStatus("EDITING"); break;
        case "percent":
          insert("%"); break;
        case "memory-clear": memory = null; updateDisplay(); showToast("Memory cleared"); break;
        case "memory-recall":
          if(memory === null) showToast("Memory is empty"); else insert(pretty(memory));
          break;
        case "memory-add": memory = (memory ?? 0) + currentValue(); updateDisplay(); showToast("Added to memory"); break;
        case "memory-subtract": memory = (memory ?? 0) - currentValue(); updateDisplay(); showToast("Subtracted from memory"); break;
        case "memory-store": memory = currentValue(); updateDisplay(); showToast("Saved to memory"); break;
      }
    } catch(err) { showToast(err.message || "Check your expression"); }
  }
  $("keypad").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.insert !== undefined) insert(button.dataset.insert);
    else if (button.dataset.action) doAction(button.dataset.action);
  });
  document.querySelector(".utility-row").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) doAction(button.dataset.action);
  });
  angleButton.addEventListener("click", () => {
    angleMode = angleMode === "DEG" ? "RAD" : "DEG";
    angleButton.textContent = angleMode;
    showToast("Angle mode: " + angleMode);
  });
  $("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("light");
    $("themeToggle").textContent = document.body.classList.contains("light") ? "☾" : "☼";
  });
  $("clearHistory").addEventListener("click", () => { history = []; renderHistory(); showToast("History cleared"); });
  $("copyResult").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(resultEl.textContent); showToast("Result copied"); }
    catch { showToast("Clipboard access is not available in this browser"); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9.]$/.test(event.key)) { insert(event.key); return; }
    const operators = {"+":"+", "-":"−", "*":"×", "/":"÷", "^":"^", "(": "(", ")":")", "%":"%"};
    if (operators[event.key]) { insert(operators[event.key]); event.preventDefault(); return; }
    if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculate(); }
    else if (event.key === "Backspace") backspace();
    else if (event.key === "Escape") clear();
  });
  updateDisplay();
  renderHistory();
})();
