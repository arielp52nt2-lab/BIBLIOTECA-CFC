const rawSheet = sessionStorage.getItem("cfc-ficha-actual");
const sheet = document.querySelector(".sheet");
const emptySheet = document.querySelector(".empty-sheet");

if (!rawSheet) {
  emptySheet.hidden = false;
} else {
  try {
    const item = JSON.parse(rawSheet);
    const category = item.category === "activador" ? "Activador" : "Dispositivo";
    const included = new Set(String(item.structuredFields?.["SECCIONES INCLUIDAS"] || "summary,duration,participants,mode").split(",").filter(Boolean));
    document.title = `${item.title || "Ficha técnica"} | CFC`;
    document.querySelector(".sheet-meta").innerHTML = [category, included.has("duration") ? item.durationLabel : "", included.has("participants") ? item.participantsLabel : "", included.has("mode") ? item.mode : ""]
      .filter(Boolean).map(value => `<span>${String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character])}</span>`).join("");
    document.querySelector(".detail-label").textContent = category;
    document.querySelector(".detail-icon").textContent = item.symbol || (item.category === "activador" ? "◷" : "◇");
    document.querySelector(".sheet-title").textContent = item.title || item.shortTitle || "Ficha técnica";
    const summary = document.querySelector(".detail-summary");
    summary.textContent = included.has("summary") ? item.summary || "" : "";
    summary.hidden = !included.has("summary");
    document.querySelector(".detail-content").innerHTML = item.html || "";
    sheet.hidden = false;
  } catch (error) {
    emptySheet.hidden = false;
  }
}
