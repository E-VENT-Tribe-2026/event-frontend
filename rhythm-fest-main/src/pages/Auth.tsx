import { useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Building2,
  Camera,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { interests as interestOptions } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
 
type Mode = "login" | "signup";
type Role = "participant" | "organizer";
 
const Auth = () => {
  const navigate = useNavigate();
 
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("participant");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
 
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    orgName: "",
    category: "",
    dob: "",
  });
 
  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };
 
  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
 
  const getAge = (dobStr: string) => {
    if (!dobStr) return 0;
 
    const dob = new Date(dobStr);
    const today = new Date();
 
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
 
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
 
    return age;
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
 
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing fields",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return;
    }
 
    if (mode === "signup") {
      if (role === "participant" && getAge(formData.dob) < 18) {
        toast({
          title: "Age restriction",
          description: "You must be at least 18 years old to sign up.",
          variant: "destructive",
        });
        return;
      }
 
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Password error",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        return;
      }
 
      if (role === "participant" && !formData.name.trim()) {
        toast({
          title: "Missing name",
          description: "Full name is required.",
          variant: "destructive",
        });
        return;
      }
 
      if (role === "organizer" && !formData.orgName.trim()) {
        toast({
          title: "Missing organization",
          description: "Organization name is required.",
          variant: "destructive",
        });
        return;
      }
    }
 
    setLoading(true);
 
    try {
      if (mode === "login") {
        const res = await fetch("http://localhost:8000/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });
 
        const data = await res.json();
        console.log("LOGIN RESPONSE:", data);
 
        if (!res.ok) {
          throw new Error(data.detail || data.message || "Login failed");
        }
 
        if (data.access_token) {
          localStorage.setItem("token", data.access_token);
        }
 
        if (data.token_type) {
          localStorage.setItem("token_type", data.token_type);
        }
 
        localStorage.setItem("user_role", role);
        localStorage.setItem("user_email", formData.email);
 
        toast({
          title: "Welcome back!",
          description: "Logged in successfully.",
        });
 
        navigate(role === "organizer" ? "/dashboard" : "/");
      } else {
        const fullName =
          role === "participant"
            ? formData.name.trim()
            : formData.orgName.trim();
 
        const res = await fetch("http://localhost:8000/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: fullName,
          }),
        });
 
        const data = await res.json();
        console.log("REGISTER RESPONSE:", data);
 
        if (!res.ok) {
          throw new Error(data.detail || data.message || "Signup failed");
        }
 
        toast({
          title: "Account created!",
          description: "Your account has been created successfully.",
        });
 
        setMode("login");
        setFormData((prev) => ({
          ...prev,
          password: "",
          confirmPassword: "",
        }));
      }
    } catch (error: any) {
      console.error(error);
 
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
 
  const handleSocialLogin = (provider: string) => {
    toast({
      title: `${provider} login`,
      description: "Social login is not connected to the backend yet.",
    });
  };
 
  return (
<div className="min-h-screen bg-background flex flex-col">
<div className="absolute inset-x-0 top-0 h-72 gradient-hero opacity-60" />
 
      <div className="relative z-10 flex-1 flex flex-col px-5 pt-12 max-w-md mx-auto w-full">
<motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
<h1 className="font-display text-3xl font-bold gradient-text text-center">
            E-VENT
</h1>
<p className="text-sm text-muted-foreground text-center mt-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
</p>
</motion.div>
 
        <div className="mt-6 flex gap-2">
          {(["participant", "organizer"] as Role[]).map((r) => (
<button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                role === r
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "glass text-muted-foreground"
              }`}
>
              {r === "participant" ? "Participant" : "Organizer"}
</button>
          ))}
</div>
 
        <div className="mt-4 flex gap-2 glass rounded-xl p-1">
          {(["login", "signup"] as Mode[]).map((m) => (
<button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
>
              {m === "login" ? "Log In" : "Sign Up"}
</button>
          ))}
</div>
 
        <motion.form
          key={`${mode}-${role}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onSubmit={handleSubmit}
          className="mt-5 space-y-3 flex-1"
>
          {mode === "signup" && (
<>
<div className="flex justify-center mb-2">
<div className="relative">
<div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
<Camera className="w-7 h-7 text-primary-foreground" />
</div>
<span className="absolute -bottom-1 text-[10px] text-muted-foreground w-full text-center">
                    {role === "organizer" ? "Logo" : "Photo"}
</span>
</div>
</div>
 
              {role === "participant" ? (
<>
<InputField
                    icon={<User className="w-4 h-4" />}
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={(v) => updateField("name", v)}
                  />
 
                  <InputField
                    type="date"
                    icon={<User className="w-4 h-4" />}
                    placeholder="Date of Birth"
                    value={formData.dob}
                    onChange={(v) => updateField("dob", v)}
                  />
 
                  {formData.dob && getAge(formData.dob) < 18 && (
<p className="text-xs text-destructive ml-1 -mt-1">
                      You must be at least 18 years old
</p>
                  )}
 
                  <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
<ChevronDown className="w-4 h-4 text-muted-foreground" />
<select className="flex-1 bg-transparent text-sm text-muted-foreground focus:outline-none appearance-none">
<option value="">Gender</option>
<option value="male">Male</option>
<option value="female">Female</option>
<option value="non-binary">Non-binary</option>
<option value="prefer-not">Prefer not to say</option>
</select>
</div>
 
                  <div>
<p className="text-xs text-muted-foreground mb-2">
                      Select your interests
</p>
<div className="flex flex-wrap gap-2">
                      {interestOptions.map((interest) => (
<button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            selectedInterests.includes(interest)
                              ? "gradient-primary text-primary-foreground"
                              : "glass text-muted-foreground"
                          }`}
>
                          {interest}
</button>
                      ))}
</div>
</div>
</>
              ) : (
<>
<InputField
                    icon={<Building2 className="w-4 h-4" />}
                    placeholder="Organization Name"
                    value={formData.orgName}
                    onChange={(v) => updateField("orgName", v)}
                  />
 
                  <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
<ChevronDown className="w-4 h-4 text-muted-foreground" />
<select
                      className="flex-1 bg-transparent text-sm text-muted-foreground focus:outline-none appearance-none"
                      value={formData.category}
                      onChange={(e) => updateField("category", e.target.value)}
>
<option value="">Category</option>
<option value="music">Music & Entertainment</option>
<option value="tech">Technology</option>
<option value="food">Food & Beverage</option>
<option value="sports">Sports & Fitness</option>
<option value="art">Art & Culture</option>
<option value="business">Business</option>
</select>
</div>
</>
              )}
</>
          )}
 
          <InputField
            icon={<Mail className="w-4 h-4" />}
            placeholder="Email"
            type="email"
            value={formData.email}
            onChange={(v) => updateField("email", v)}
          />
 
          <div className="relative">
<InputField
              icon={<Lock className="w-4 h-4" />}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(v) => updateField("password", v)}
            />
 
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
>
              {showPassword ? (
<EyeOff className="w-4 h-4" />
              ) : (
<Eye className="w-4 h-4" />
              )}
</button>
</div>
 
          {mode === "signup" && (
<InputField
              icon={<Lock className="w-4 h-4" />}
              placeholder="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(v) => updateField("confirmPassword", v)}
            />
          )}
 
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow hover:opacity-90 transition-opacity mt-2 disabled:opacity-60"
>
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
              ? "Log In"
              : "Create Account"}
</button>
</motion.form>
 
        <div className="mt-5 mb-8">
<div className="flex items-center gap-3 mb-4">
<div className="flex-1 h-px bg-border" />
<span className="text-xs text-muted-foreground">or continue with</span>
<div className="flex-1 h-px bg-border" />
</div>
 
          <div className="flex gap-3">
<SocialButton label="Google" onClick={() => handleSocialLogin("Google")}>
<svg viewBox="0 0 24 24" className="w-5 h-5">
<path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
<path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
<path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
<path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
</svg>
</SocialButton>
 
            <SocialButton label="Facebook" onClick={() => handleSocialLogin("Facebook")}>
<svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
<path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
</svg>
</SocialButton>
 
            <SocialButton label="LinkedIn" onClick={() => handleSocialLogin("LinkedIn")}>
<svg viewBox="0 0 24 24" className="w-5 h-5" fill="#0A66C2">
<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
</svg>
</SocialButton>
</div>
</div>
</div>
</div>
  );
};
 
const InputField = ({
  icon,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  icon: React.ReactNode;
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
}) => (
<div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
<span className="text-muted-foreground">{icon}</span>
<input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
    />
</div>
);
 
const SocialButton = ({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) => (
<button
    type="button"
    onClick={onClick}
    className="flex-1 glass rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
    aria-label={label}
>
    {children}
</button>
);
 
export default Auth;