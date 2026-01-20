import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Rocket, Sparkles, History, Languages } from 'lucide-react';
import updateContentEN from '../assets/UPDATE.md?raw';
import updateContentFR from '../assets/UPDATE_FR.md?raw';

const LatestUpdatePage = () => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('guide_lang'); // Use same preference as guide
    return saved || (navigator.language.startsWith('fr') ? 'fr' : 'en');
  });

  const toggleLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('guide_lang', lang);
  };

  const content = language === 'fr' ? updateContentFR : updateContentEN;

  return (
    <div className="h-screen fixed inset-0 z-50 flex flex-col bg-background selection:bg-primary/20">
      {/* Premium Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Rocket size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {language === 'fr' ? 'Dernières Mises à Jour' : 'Latest Updates'}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                v1.1.0
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
              EN
            </button>
            <button
              onClick={() => toggleLanguage('fr')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${language === 'fr'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              FR
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 pb-32">
          {/* Hero Section */}
          <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/20 via-background to-purple-600/10 border border-border/50 p-12 group text-center">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles size={120} />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase mb-6">
              New Release
            </div>
            <h2 className="text-4xl font-black text-foreground mb-4">
              {language === 'fr' ? 'La Mise à Jour Globale est là' : 'The Global Update is Here'}
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {language === 'fr'
                ? 'Découvrez ReView 1.1.0 : Début de l\'internationalisation, révision 3D avancée et stabilité accrue.'
                : 'Discover ReView 1.1.0: First steps of internationalization, advanced 3D review, and enhanced stability.'}
            </p>
          </div>

          {/* Discord Banner */}
          <div className="mb-16 relative overflow-hidden rounded-2xl bg-[#5865F2] p-8 text-white shadow-xl shadow-[#5865F2]/20 group">
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
                href="https://discord.gg/RFsD7hmPRq"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white text-[#5865F2] font-black rounded-lg hover:bg-white/90 transition-all hover:scale-105 shadow-lg whitespace-nowrap"
              >
                {language === 'fr' ? 'Rejoindre le Discord' : 'Join Discord Server'}
              </a>
            </div>
          </div>

          <article className="prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary hover:prose-a:underline prose-strong:text-foreground prose-li:text-muted-foreground prose-code:text-accent-foreground prose-code:bg-accent/20 prose-code:rounded prose-code:px-1 prose-pre:bg-muted/50 max-w-none">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-2xl font-bold mb-8 flex items-center gap-3">
                    <Sparkles className="text-primary" size={24} />
                    {props.children}
                  </h1>
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-xl font-bold mt-12 mb-6 border-b border-border/50 pb-2 flex items-center gap-2">
                    {props.children}
                  </h2>
                ),
                li: ({ node, ...props }) => (
                  <li className="mb-2 list-none flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                    <span>{props.children}</span>
                  </li>
                ),
                hr: () => <hr className="my-16 border-border/30" />
              }}
            >
              {content}
            </ReactMarkdown>
          </article>

          <div className="mt-24 p-8 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center text-center">
            <History size={32} className="text-muted-foreground mb-4" />
            <h3 className="font-bold mb-2">
              {language === 'fr' ? 'Vous voulez en savoir plus ?' : 'Want to learn more?'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {language === 'fr'
                ? 'Consultez notre guide utilisateur pour découvrir comment utiliser ces nouvelles fonctionnalités.'
                : 'Check out our user guide to learn how to use these new features.'}
            </p>
            <a
              href="/guide"
              className="px-6 py-2 bg-foreground text-background rounded-full text-sm font-bold hover:scale-105 transition-transform"
            >
              {language === 'fr' ? 'Voir le Guide' : 'View Guide'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LatestUpdatePage;
