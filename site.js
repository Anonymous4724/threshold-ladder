/* The pages around the predictor need two things a static page cannot do:
 * read a chart off under the pointer, and show the week's start times in the
 * reader's own clock. Everything else on these pages is plain HTML. */
(function () {
  "use strict";
  var fr = document.documentElement.lang === "fr";

  /* Start times: written in UTC by the build, shown in the reader's zone. */
  try {
    var day = new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    document.querySelectorAll(".when time[datetime]").forEach(function (el) {
      var at = new Date(el.getAttribute("datetime"));
      if (isNaN(at)) return;
      el.textContent = day.format(at);
      var utc = el.parentNode.querySelector(".utc");
      if (utc) utc.textContent = zone ? zone.split("/").pop().replace(/_/g, " ") : "";
    });
    // A cup already over stays in the list, greyed, until the next refresh.
    var now = Date.now();
    document.querySelectorAll("ul.week li[data-end]").forEach(function (li) {
      var end = Date.parse(li.getAttribute("data-end"));
      if (!isNaN(end) && end < now) li.classList.add("past");
    });
  } catch (e) { /* the UTC times stay */ }

  /* Line charts: the nearest column of points under the pointer, read off in
   * a small box, with a thin rule through it. The native tooltips on each
   * point stay for keyboards and screen readers. */
  document.querySelectorAll("svg.chart[data-hover='line']").forEach(function (svg) {
    var fig = svg.closest(".chart-fig");
    var dots = [].slice.call(svg.querySelectorAll("circle.dot"));
    if (!fig || !dots.length) return;
    var columns = {};
    dots.forEach(function (d) {
      var x = Math.round(parseFloat(d.getAttribute("cx")));
      (columns[x] = columns[x] || []).push(d);
    });
    var xs = Object.keys(columns).map(Number).sort(function (a, b) { return a - b; });
    var ns = "http://www.w3.org/2000/svg";
    var rule = document.createElementNS(ns, "line");
    rule.setAttribute("class", "cross");
    rule.style.display = "none";
    svg.insertBefore(rule, svg.firstChild);
    var tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.hidden = true;
    fig.appendChild(tip);
    var box = svg.viewBox.baseVal;
    function show(evt) {
      var r = svg.getBoundingClientRect();
      var px = (evt.clientX - r.left) * box.width / r.width;
      var best = xs[0];
      xs.forEach(function (x) { if (Math.abs(x - px) < Math.abs(best - px)) best = x; });
      var col = columns[best];
      rule.setAttribute("x1", best); rule.setAttribute("x2", best);
      rule.setAttribute("y1", 10); rule.setAttribute("y2", box.height - 40);
      rule.style.display = "";
      var lines = col.map(function (d) {
        var t = (d.querySelector("title") || {}).textContent || "";
        var cls = (d.getAttribute("class") || "").split(" ").pop();
        return "<div><i style=\"background:var(--" + cls + ")\"></i>" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/: ([^:]+)$/, ": <b>$1</b>") + "</div>";
      });
      tip.innerHTML = lines.join("");
      tip.hidden = false;
      var fr2 = fig.getBoundingClientRect();
      var left = evt.clientX - fr2.left + 14;
      if (left + tip.offsetWidth > fr2.width - 8) left = evt.clientX - fr2.left - tip.offsetWidth - 14;
      tip.style.left = Math.max(8, left) + "px";
      tip.style.top = (evt.clientY - fr2.top + 12) + "px";
    }
    function hide() { rule.style.display = "none"; tip.hidden = true; }
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", hide);
  });
})();
