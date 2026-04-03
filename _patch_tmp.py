from pathlib import Path
p = Path("src/components/upgrade-page.tsx")
text = p.read_text(encoding="utf-8")
text = text.replace("setLoading(true);", "setLoadingPlan(\"business\");", 1)
idx = text.find("___MARKER___")
