import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Languages, HelpCircle, ChevronRight, BookOpen } from 'lucide-react';
import guideContentEN from '../assets/GUIDE.md?raw';
import guideContentFR from '../assets/GUIDE_FR.md?raw';

const GuidePage = () => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('guide_lang');
    return saved || (navigator.language.startsWith('fr') ? 'fr' : 'en');
  });

  const toggleLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('guide_lang', lang);
  };

  const content = language === 'fr' ? guideContentFR : guideContentEN;

  return (
    <div className="h-screen fixed inset-0 z-50 flex flex-col bg-background selection:bg-primary/20">
      {/* Premium Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {language === 'fr' ? 'Guide Utilisateur' : 'User Guide'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {language === 'fr' ? 'Tout savoir sur ReView' : 'Learn everything about ReView'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/50">
            <button
              onClick={() => toggleLanguage('en')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${language === 'en'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              English
            </button>
            <button
              onClick={() => toggleLanguage('fr')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${language === 'fr'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Français
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8 pb-32">
          {/* Banner */}
          <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-background to-accent/5 border border-border/50 p-12 text-center group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Languages size={120} />
            </div>
            <img src="/logo_banner.png" alt="ReView Logo" className="h-12 mx-auto mb-6 object-contain" />
            <h2 className="text-3xl font-black text-foreground mb-4">
              {language === 'fr' ? 'Comment pouvons-nous vous aider ?' : 'How can we help you?'}
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              {language === 'fr'
                ? 'Le guide complet pour maîtriser les outils de révision, la collaboration en équipe et l’approbation client.'
                : 'The complete guide to mastering review tools, team collaboration, and client approval.'}
            </p>
          </div>

          {/* Discord Banner */}
          <div className="mb-12 relative overflow-hidden rounded-2xl bg-[#5865F2] p-8 text-white shadow-xl shadow-[#5865F2]/20 group">
            <div className="absolute inset-0 bg-[url('https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png')] bg-no-repeat bg-[length:400px] bg-right-bottom -bottom-20 -right-20 opacity-10 group-hover:scale-105 transition-transform duration-500 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="bg-white p-3 rounded-xl shadow-lg shrink-0">
                  <img src="/logo_icon.png" className="w-10 h-10 object-contain" alt="ReView" />
                </div>
                <div className="text-white/50 text-2xl font-black">+</div>
                <div className="bg-white p-3 rounded-xl shadow-lg shrink-0">
                  <img src="https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d80db9971f10a9757c99_Symbol.svg" className="w-10 h-10 object-contain" alt="Discord" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-xl mb-1">
                    {language === 'fr' ? 'Rejoignez la Communauté' : 'Join the Community'}
                  </h3>
                  <p className="text-white/80 text-sm max-w-md">
                    {language === 'fr'
                      ? 'Discutez avec les développeurs, partagez vos idées et obtenez de l\'aide en direct.'
                      : 'Chat with developers, share your ideas, and get live support.'}
                  </p>
                </div>
              </div>
              <a
                href="https://discord.gg/VXbA3NhyNb"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white text-[#5865F2] font-black rounded-lg hover:bg-white/90 transition-all hover:scale-105 shadow-lg whitespace-nowrap"
              >
                {language === 'fr' ? 'Rejoindre le Discord' : 'Join Discord Server'}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12">
            <article className="prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary hover:prose-a:underline prose-strong:text-foreground prose-li:text-muted-foreground prose-code:text-accent-foreground prose-code:bg-accent/20 prose-code:rounded prose-code:px-1 prose-pre:bg-muted/50 max-w-none transition-all">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ node, ...props }) => {
                    const id = props.children?.toString()
                      .toLowerCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
                      .replace(/[^\w\s-]/g, '') // Remove special chars
                      .replace(/\s+/g, '-');
                    return (
                      <h2 id={id} {...props} className="scroll-mt-24 border-b border-border/50 pb-2 flex items-center gap-2 group">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary text-sm font-mono mt-1">#</span>
                        {props.children}
                      </h2>
                    );
                  },
                  img: ({ node, ...props }) => (
                    <div className="my-10 space-y-2">
                      <div className="rounded-2xl overflow-hidden border border-border bg-muted/20 shadow-2xl">
                        <img {...props} className="w-full h-auto m-0 hover:scale-[1.02] transition-transform duration-500" />
                      </div>
                      {props.title && <p className="text-center text-xs text-muted-foreground italic">{props.title}</p>}
                    </div>
                  ),
                  hr: () => <hr className="my-16 border-border/30" />
                }}
              >
                {content}
              </ReactMarkdown>
            </article>

            {/* Quick Links / TOC side */}
            <div className="hidden lg:block">
              <div className="sticky top-32 space-y-8">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    {language === 'fr' ? 'DANS CE GUIDE' : 'ON THIS PAGE'}
                  </h4>
                  <nav className="flex flex-col gap-2">
                    {[
                      { id: language === 'fr' ? 'projets' : 'projects', label: language === 'fr' ? 'Projets' : 'Projects' },
                      { id: language === 'fr' ? 'equipes' : 'teams', label: language === 'fr' ? 'Équipes' : 'Teams' },
                      { id: language === 'fr' ? 'revision--commentaires' : 'review--comments', label: language === 'fr' ? 'Révision & Commentaires' : 'Review & Comments' },
                      { id: 'annotations', label: 'Annotations' },
                      { id: language === 'fr' ? 'revision-client' : 'client-review', label: language === 'fr' ? 'Révision Client' : 'Client Review' },
                      { id: language === 'fr' ? 'corbeille--recuperation' : 'trash--recovery', label: language === 'fr' ? 'Corbeille' : 'Trash' },
                    ].map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 group transition-colors"
                      >
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -ml-4 transition-all" />
                        {item.label}
                      </a>
                    ))}
                  </nav>
                </div>

                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                  <HelpCircle size={24} className="text-primary mb-3" />
                  <h5 className="text-sm font-bold mb-1">
                    {language === 'fr' ? 'Besoin d\'aide ?' : 'Need help?'}
                  </h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {language === 'fr'
                      ? 'Vous ne trouvez pas ce que vous cherchez ? Contactez notre support technique.'
                      : 'Can\'t find what you\'re looking for? Reach out to our technical support.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
