import { useState } from "react";
import { ArrowLeft, ImagePlus, MapPin, Save, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { categories } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";

const CreateEvent = () => {
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [participantLimit, setParticipantLimit] = useState(100);
  const [formData, setFormData] = useState({ title: "", description: "", date: "", time: "", price: "free" });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePublish = () => {
    if (!formData.title) {
      toast({ title: "Missing title", description: "Please enter an event title", variant: "destructive" });
      return;
    }
    toast({ title: "Event Published! 🎉", description: `"${formData.title}" is now live` });
    navigate("/dashboard");
  };

  const handleSaveDraft = () => {
    toast({ title: "Draft Saved", description: "Your event has been saved as a draft" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 glass border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display text-lg font-bold text-foreground">Create Event</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 max-w-2xl mx-auto mt-4 space-y-4"
      >
        {/* Image upload */}
        <div className="glass rounded-2xl h-44 flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
          <ImagePlus className="w-10 h-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Upload event banner</p>
        </div>

        <Field label="Title" placeholder="Event title" value={formData.title} onChange={(v) => updateField("title", v)} />
        <Field label="Description" placeholder="Describe your event..." textarea value={formData.description} onChange={(v) => updateField("description", v)} />

        {/* Category */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.filter(c => c !== "All").map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedCat === cat
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={formData.date} onChange={(v) => updateField("date", v)} />
          <Field label="Time" type="time" value={formData.time} onChange={(v) => updateField("time", v)} />
        </div>

        {/* Location */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Location</label>
          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Select on map</span>
          </div>
        </div>

        {/* Participant limit */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Participant Limit: <span className="text-foreground font-semibold">{participantLimit}</span>
          </label>
          <input
            type="range"
            min="10"
            max="5000"
            value={participantLimit}
            onChange={(e) => setParticipantLimit(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>10</span><span>5000</span>
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Ticket Price</label>
          <select
            value={formData.price}
            onChange={(e) => updateField("price", e.target.value)}
            className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground bg-transparent focus:outline-none appearance-none"
          >
            <option value="free">Free</option>
            <option value="paid">Paid - Set price</option>
          </select>
        </div>

        {/* Privacy toggle */}
        <div className="flex items-center justify-between glass rounded-xl px-4 py-3">
          <span className="text-sm text-foreground">Private Event</span>
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={`w-11 h-6 rounded-full relative transition-colors ${isPrivate ? "gradient-primary" : "bg-secondary"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-foreground absolute top-0.5 transition-transform ${isPrivate ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Survey builder */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Survey Question (optional)</label>
          <input
            placeholder="e.g. What's your dietary preference?"
            className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2 pb-4">
          <button
            onClick={handleSaveDraft}
            className="flex-1 py-3 rounded-xl glass text-sm font-semibold text-foreground flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
          >
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button
            onClick={handlePublish}
            className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-glow hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" /> Publish
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Field = ({
  label,
  placeholder,
  type = "text",
  textarea = false,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
    {textarea ? (
      <textarea
        placeholder={placeholder}
        rows={3}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
      />
    ) : (
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    )}
  </div>
);

export default CreateEvent;
