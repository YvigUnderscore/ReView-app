import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video, Shield, Code, Cpu, Activity, Play, CheckCircle,
  Users, Layers, Zap, MessageSquare, PenTool, Globe,
  Server, Lock, FileVideo, Image as ImageIcon, Box
} from 'lucide-react';

const LandingPage = () => {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary selection:text-white overflow-x-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed w-full top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2 font-bold text-xl">
              <Video className="text-primary" />
              <span>ReView</span>
           </div>
           <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">Login</Link>
              <Link to="/register" className="bg-primary hover:bg-primary/90 text-black px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105">
                 Get Started
              </Link>
           </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center relative">
         <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 blur-[100px] rounded-full -z-10 pointer-events-none opacity-50" />

         <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.5 }}
           className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary mb-6"
         >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            v1.0 Now Available
         </motion.div>

         <motion.h1
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
           className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-transparent whitespace-pre-line"
         >
            Review{'\n'}Your Open Source Solution for Video/Images/3D assets reviewer.
         </motion.h1>

         <motion.p
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
         >
            A self-hosted, secure, and free platform for creative collaboration.
            Streamline your creative feedback loop effortlessly.
         </motion.p>

         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
           className="flex flex-col sm:flex-row items-center justify-center gap-4"
         >
             <a href="https://github.com/YvigUnderscore/ReView-app/blob/main/installation.md" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-all hover:scale-105 shadow-lg shadow-white/10">
                Start for Free
             </a>
             <a href="https://github.com/YvigUnderscore/ReView-app" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-center gap-2 backdrop-blur-sm">
                <Code size={18} /> View Source
             </a>
         </motion.div>

         {/* Enhanced Dashboard Mockup */}
         <motion.div
            initial={{ opacity: 0, y: 50, rotateX: 10 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, type: "spring" }}
            className="mt-20 relative rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-2xl shadow-primary/20 overflow-hidden text-left max-w-6xl mx-auto"
         >
             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none"></div>

             {/* Browser Chrome */}
             <div className="h-8 bg-zinc-900 border-b border-white/5 flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                   <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                   <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                   <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
                <div className="flex-1 text-center text-xs text-zinc-600 font-mono">localhost:3000/projects/review</div>
             </div>

             {/* App Window */}
             <div className="flex h-[500px] md:h-[700px] bg-zinc-950 overflow-hidden relative">
                {/* 1. Left Sidebar (Navigation) */}
                <div className="w-16 border-r border-white/5 bg-zinc-900 flex flex-col items-center py-6 gap-6 hidden md:flex z-20">
                   <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                      <Video size={20} />
                   </div>
                   <div className="w-full h-px bg-white/5"></div>
                   <div className="flex flex-col gap-4 text-zinc-500">
                      <div className="p-2 text-primary bg-white/5 rounded-lg"><Layers size={20} /></div>
                      <div className="p-2 hover:text-zinc-300 transition-colors"><Users size={20} /></div>
                      <div className="p-2 hover:text-zinc-300 transition-colors"><Activity size={20} /></div>
                   </div>
                   <div className="mt-auto">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 border border-white/20"></div>
                   </div>
                </div>

                {/* 2. Main Viewer Area */}
                <div className="flex-1 flex flex-col bg-zinc-950 relative">
                   {/* Top Bar */}
                   <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur z-20">
                      <div className="flex items-center gap-3">
                         <h2 className="font-semibold">Cinematic_Shot_v04.mp4</h2>
                         <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 text-xs border border-green-500/30">In Progress</span>
                      </div>
                      <div className="flex items-center -space-x-2">
                         {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-xs">
                               <Users size={12} className="text-zinc-500" />
                            </div>
                         ))}
                         <div className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">+2</div>
                         <button className="ml-4 bg-primary text-black text-xs font-bold px-3 py-1.5 rounded-md">Share</button>
                      </div>
                   </div>

                   {/* Video Canvas Simulation */}
                   <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-zinc-950"></div>

                       {/* Grid Pattern */}
                       <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                       {/* The "Video" Content */}
                       <div className="relative w-[80%] aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border border-white/5 group">
                           {/* Placeholder Image/Gradient */}
                           <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black"></div>

                           {/* Simulated 3D/Video Element */}
                           <div className="absolute inset-0 flex items-center justify-center">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="w-32 h-32 border-4 border-primary/30 rounded-full border-t-primary"
                              />
                           </div>

                           {/* Annotation Overlay */}
                           <svg className="absolute inset-0 w-full h-full pointer-events-none">
                              <motion.path
                                initial={{ pathLength: 0, opacity: 0 }}
                                whileInView={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 1.5, delay: 1 }}
                                d="M 150 200 Q 300 150 450 250"
                                stroke="#FFD700"
                                strokeWidth="4"
                                fill="none"
                                strokeLinecap="round"
                              />
                              <motion.circle
                                initial={{ scale: 0, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 2.5 }}
                                cx="450" cy="250" r="15" fill="none" stroke="#FFD700" strokeWidth="2"
                              />
                           </svg>
                       </div>

                       {/* Floating Toolbar */}
                       <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/90 backdrop-blur px-4 py-2 rounded-full border border-white/10 shadow-xl">
                          <button className="p-2 hover:bg-white/10 rounded-full"><Play size={16} fill="white" /></button>
                          <div className="w-px h-4 bg-white/20 mx-1"></div>
                          <button className="p-2 hover:bg-white/10 rounded-full text-primary"><PenTool size={16} /></button>
                          <button className="p-2 hover:bg-white/10 rounded-full"><MessageSquare size={16} /></button>
                       </div>
                   </div>

                   {/* Timeline */}
                   <div className="h-16 bg-zinc-900 border-t border-white/5 flex flex-col justify-center px-4 relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
                         <div className="h-full bg-primary w-1/3 relative">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg border border-white"></div>
                         </div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 mt-2 font-mono">
                         <span>00:00:12:05</span>
                         <span>00:01:30:00</span>
                      </div>
                      {/* Timeline Markers */}
                      <div className="absolute top-1 left-[20%] w-1 h-2 bg-yellow-500"></div>
                      <div className="absolute top-1 left-[45%] w-1 h-2 bg-blue-500"></div>
                      <div className="absolute top-1 left-[70%] w-1 h-2 bg-green-500"></div>
                   </div>
                </div>

                {/* 3. Right Sidebar (Comments) */}
                <div className="w-80 border-l border-white/5 bg-zinc-900 flex flex-col hidden lg:flex z-20">
                    <div className="p-4 border-b border-white/5 font-semibold text-sm">Comments (3)</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                       {/* Comment 1 */}
                       <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold border border-blue-500/30">JD</div>
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">John Doe</span>
                                <span className="text-xs text-zinc-500">10m ago</span>
                             </div>
                             <p className="text-sm text-zinc-300 bg-white/5 p-3 rounded-lg rounded-tl-none border border-white/5">
                                Can we adjust the lighting here? It feels a bit too dark.
                             </p>
                          </div>
                       </div>

                       {/* Comment 2 (Active) */}
                       <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold border border-primary/30">Sarah</div>
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-primary">Sarah Smith</span>
                                <span className="text-xs text-zinc-500">Just now</span>
                             </div>
                             <p className="text-sm text-white bg-primary/10 p-3 rounded-lg rounded-tl-none border border-primary/20 ring-1 ring-primary/30">
                                @John I've marked the area that needs brightening.
                             </p>
                          </div>
                       </div>
                    </div>
                    {/* Input */}
                    <div className="p-4 border-t border-white/5">
                       <div className="bg-zinc-950 border border-white/10 rounded-lg p-3 text-sm text-zinc-500 flex justify-between items-center">
                          <span>Write a comment...</span>
                          <div className="px-2 py-1 rounded bg-white/10 text-xs">Shift + Enter</div>
                       </div>
                    </div>
                </div>
             </div>
         </motion.div>
      </section>

      {/* Supported Media Types */}
      <section className="py-20 bg-zinc-900/50 border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6">
              <motion.div
                {...fadeInUp}
                className="text-center mb-16"
              >
                  <h2 className="text-3xl font-bold mb-4">Any Asset, One Platform</h2>
                  <p className="text-zinc-400">Comprehensive support for your entire creative pipeline.</p>
              </motion.div>

              <motion.div
                 variants={staggerContainer}
                 initial="hidden"
                 whileInView="show"
                 viewport={{ once: true }}
                 className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                  <MediaCard
                     icon={FileVideo}
                     title="Video Playback"
                     desc="Frame-accurate playback, variable speed, loop ranges, and split-screen comparison."
                     color="text-blue-400"
                  />
                  <MediaCard
                     icon={ImageIcon}
                     title="Image Sequences"
                     desc="Review storyboards, concept art, and renders with gallery view and drawing tools."
                     color="text-purple-400"
                  />
                  <MediaCard
                     icon={Box}
                     title="3D Models"
                     desc="Interactive 3D viewer for GLB/GLTF/FBX files. Inspect geometry and textures directly in browser."
                     color="text-orange-400"
                  />
              </motion.div>
          </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Streamlined Workflow</h2>
              <p className="text-zinc-400">From upload to final approval in three simple steps.</p>
          </motion.div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-zinc-800 via-primary/50 to-zinc-800 border-t border-dashed border-white/20 z-0"></div>

              <StepCard
                 number="01"
                 title="Upload"
                 desc="Drag & drop your assets. We handle the processing and versioning automatically."
              />
              <StepCard
                 number="02"
                 title="Collaborate"
                 desc="Invite your team or clients. Leave frame-accurate comments and annotations."
              />
              <StepCard
                 number="03"
                 title="Approve"
                 desc="Mark tasks as resolved, compare versions, and get to final approval faster."
              />
          </div>
      </section>

      {/* Why Self-Hosted / Features */}
      <section className="py-24 px-6 bg-zinc-900 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <motion.div {...fadeInUp}>
                      <h2 className="text-3xl md:text-4xl font-bold mb-6">Why Self-Hosted?</h2>
                      <div className="space-y-6">
                          <BenefitItem
                             icon={Lock}
                             title="Total Data Sovereignty"
                             desc="Your intellectual property never leaves your server. You control the security protocols."
                          />
                          <BenefitItem
                             icon={Server}
                             title="No Infrastructure Lock-in"
                             desc="Deploy on your own hardware, AWS, DigitalOcean, or a Raspberry Pi. You decide."
                          />
                          <BenefitItem
                             icon={Zap}
                             title="Zero Subscription Costs"
                             desc="Stop paying per user or per GB. Scale your team without scaling your monthly bills."
                          />
                      </div>
                  </motion.div>

                  {/* Feature Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FeatureCard icon={Shield} title="Enterprise Security" desc="Role-based access control and secure invites." />
                      <FeatureCard icon={Users} title="Team Management" desc="Organize users into teams with specific permissions." />
                      <FeatureCard icon={Globe} title="Client Review" desc="Share secure public links for external stakeholders." />
                      <FeatureCard icon={PenTool} title="Vector Drawing" desc="Precise annotation tools for clear feedback." />
                  </div>
              </div>
          </div>
      </section>

      {/* Roadmap */}
      <section className="py-24 px-6 border-b border-white/5">
         <div className="max-w-4xl mx-auto">
            <motion.div {...fadeInUp} className="text-center mb-12">
               <h2 className="text-3xl font-bold mb-4">Roadmap</h2>
               <p className="text-zinc-400">We're just getting started. Here's what's coming next.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {[
                  "SSO Authentication (Google, GitHub, Discord)",
                  "Two-Factor Authentication (2FA)",
                  "Storage Quotas & Management",
                  "Customizable Keyboard Shortcuts",
                  "Webhook Integrations (Slack/Discord/Teams)",
                  "Adaptive Transcoding (HLS)",
                  "Folders and Subfolders Organization",
                  "Command Palette (Cmd+K)",
                  "DCC Integrations (Blender, Maya, etc.)"
               ].map((item, index) => (
                  <motion.div
                     initial={{ opacity: 0, x: -10 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ delay: index * 0.05 }}
                     key={index}
                     className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-primary/30 transition-colors group"
                  >
                     <div className="h-6 w-6 shrink-0 rounded-full border-2 border-zinc-700 group-hover:border-primary flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                        <span className="text-[10px] font-bold">{index + 1}</span>
                     </div>
                     <span className="text-zinc-300 group-hover:text-white transition-colors">{item}</span>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 text-center px-6">
          <motion.div
             initial={{ scale: 0.9, opacity: 0 }}
             whileInView={{ scale: 1, opacity: 1 }}
             viewport={{ once: true }}
             className="max-w-2xl mx-auto"
          >
              <h2 className="text-4xl font-bold mb-6">Ready to take control?</h2>
              <p className="text-xl text-zinc-400 mb-10">
                 Join the community and start streamlining your production pipeline today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                 <Link to="/register" className="w-full sm:w-auto px-8 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-all hover:scale-105">
                    Get Started Now
                 </Link>
                 <a href="https://discord.gg/yourdiscord" className="w-full sm:w-auto px-8 py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-all hover:scale-105">
                    Join Discord
                 </a>
              </div>
          </motion.div>
      </section>

      <footer className="py-10 border-t border-white/10 text-center text-zinc-600 text-sm bg-black">
         <p>&copy; 2026 ReView Open Source Project. Licensed under MIT. YvigUnderscore - Yvig Bidon</p>
      </footer>
    </div>
  );
};

/* Sub-components */

const FeatureCard = ({ icon: Icon, title, desc }) => (
    <motion.div
       whileHover={{ scale: 1.02 }}
       className="p-6 rounded-xl bg-zinc-900 border border-white/5 hover:border-primary/50 transition-colors"
    >
        <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center mb-4 text-primary border border-white/5">
            <Icon size={20} />
        </div>
        <h3 className="font-bold mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
    </motion.div>
);

const MediaCard = ({ icon: Icon, title, desc, color }) => (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
      className="p-8 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/10 hover:bg-zinc-800/50 transition-all text-center group"
    >
        <div className={`w-16 h-16 mx-auto ${color} bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
            <Icon size={32} />
        </div>
        <h3 className="text-xl font-bold mb-3">{title}</h3>
        <p className="text-zinc-400 leading-relaxed">{desc}</p>
    </motion.div>
);

const StepCard = ({ number, title, desc }) => (
    <motion.div
       initial={{ opacity: 0, y: 20 }}
       whileInView={{ opacity: 1, y: 0 }}
       viewport={{ once: true }}
       className="relative z-10 flex flex-col items-center text-center bg-black p-6 rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
    >
        <div className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center text-xl font-bold font-mono text-primary mb-6 shadow-lg shadow-primary/10">
            {number}
        </div>
        <h3 className="text-xl font-bold mb-3">{title}</h3>
        <p className="text-zinc-400">{desc}</p>
    </motion.div>
);

const BenefitItem = ({ icon: Icon, title, desc }) => (
    <div className="flex gap-4">
        <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon size={24} />
        </div>
        <div>
            <h3 className="text-lg font-bold mb-1">{title}</h3>
            <p className="text-zinc-400">{desc}</p>
        </div>
    </div>
);

export default LandingPage;
