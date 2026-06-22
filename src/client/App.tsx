import React, { useState, useEffect } from 'react';
import { api, getDevUserId, setDevUserId } from './api.ts';
import { General, Consejero, UserProfile, Action, ActionLog, BattleResult, BattleRound } from '../shared/types/index.ts';
import { PRNG, CAMPAIGN_EVENTS, BASE_STAT, calculatePower, calculateTier, deriveAbilities } from '../shared/sim/index.ts';
import { ICON, avatarFor, SPRITE } from './assets.ts';

// Iconito pixel-art reutilizable (reemplaza emojis del pack de sprites)
function Icon({ src, className = '' }: { src: string; className?: string }) {
  return <img className={`spr-icon ${className}`} src={src} alt="" draggable={false} />;
}

type Screen = 'home' | 'coleccion' | 'run-setup' | 'run-play' | 'pvp' | 'pvp-combat' | 'eventos';

const RANDOM_NAMES = [
  'Aldric', 'Brienne', 'Cerdic', 'Darius', 'Eadric',
  'Godric', 'Karr', 'Lothar', 'Orin', 'Roderic',
  'Theodoric', 'Uther', 'Valerius', 'Wulfric', 'Titus'
];

export default function App() {
  // Navigation & Modals
  const [screen, setScreen] = useState<Screen>('home');
  const [jugarModalOpen, setJugarModalOpen] = useState<boolean>(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState<boolean>(false);
  const [upgradeAdvisor, setUpgradeAdvisor] = useState<Consejero | null>(null);

  // Player / Auth state
  const [userId, setUserId] = useState<string>(getDevUserId());
  const [tempUserId, setTempUserId] = useState<string>(userId);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [advisors, setAdvisors] = useState<Consejero[]>([]);
  const [generals, setGenerals] = useState<General[]>([]);
  const [selectedGeneralId, setSelectedGeneralId] = useState<string>('');
  
  // Leaderboard data in Arena
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbPage, setLbPage] = useState<number>(1);
  
  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active training run state
  const [runId, setRunId] = useState<string>('');
  const [runSeed, setRunSeed] = useState<string>('');
  const [generalName, setGeneralName] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [runActionLog, setRunActionLog] = useState<ActionLog>([]);
  const [runStats, setRunStats] = useState({ ofe: BASE_STAT, def: BASE_STAT, man: BASE_STAT });
  const [runEvents, setRunEvents] = useState<{ turn: number; name: string; desc: string }[]>([]);
  
  // Setup Selection State (Advisors choice)
  const [selectedSetupAdvisors, setSelectedSetupAdvisors] = useState<string[]>([]);
  
  // PVP Combat state
  const [activeBattle, setActiveBattle] = useState<BattleResult | null>(null);
  const [battleRewards, setBattleRewards] = useState<any | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(-1);
  const [battleHp, setBattleHp] = useState({ hpA: 100, hpB: 100, maxA: 100, maxB: 100 });
  const [combatFinished, setCombatFinished] = useState<boolean>(false);
  const [isSearchingRival, setIsSearchingRival] = useState<boolean>(false);

  // Collection Active Tab
  const [activeTab, setActiveTab] = useState<'consejeros' | 'generales'>('consejeros');

  // Load profile, generals, advisors on startup or user ID change
  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prof = await api.get<UserProfile>('/api/profile');
      setProfile(prof);
      const advs = await api.get<Consejero[]>('/api/consejeros');
      setAdvisors(advs);
      
      // Auto-select first 3 advisors for run setup if not selected
      if (advs.length >= 3) {
        setSelectedSetupAdvisors(advs.slice(0, 3).map(a => a.id));
      }

      const gens = await api.get<General[]>('/api/run/generals');
      setGenerals(gens);
      if (gens.length > 0 && !selectedGeneralId) {
        setSelectedGeneralId(gens[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = () => {
    if (tempUserId.trim()) {
      setDevUserId(tempUserId.trim());
      setUserId(tempUserId.trim());
      setOptionsModalOpen(false);
      setScreen('home');
    }
  };

  const handleRandomizeName = () => {
    const idx = Math.floor(Math.random() * RANDOM_NAMES.length);
    setGeneralName(RANDOM_NAMES[idx]);
  };

  // Progression: Level advisor
  const handleLevelAdvisorSubmit = async () => {
    if (!upgradeAdvisor) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/api/consejeros/${upgradeAdvisor.id}/level`);
      setUpgradeAdvisor(null);
      await loadUserData();
    } catch (err: any) {
      setError(err.message || 'Error al subir nivel del consejero.');
    } finally {
      setLoading(false);
    }
  };

  // Training Run Setup
  const handleStartTrainingSetup = () => {
    setGeneralName('');
    setJugarModalOpen(false);
    setScreen('run-setup');
  };

  const handleStartTrainingRun = async () => {
    if (!generalName.trim()) {
      setError('Por favor escribe o aleatoriza un nombre para tu general.');
      return;
    }
    if (selectedSetupAdvisors.length < 3) {
      setError('Debes seleccionar exactamente 3 consejeros para el entrenamiento.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // Map selection to advisor objects
      const deckSnapshot = advisors.filter(a => selectedSetupAdvisors.includes(a.id));
      const startResult = await api.post<{ runId: string; seed: string }>(
        '/api/run/start',
        { deckSnapshot }
      );

      setRunId(startResult.runId);
      setRunSeed(startResult.seed);
      setCurrentTurn(0);
      setRunActionLog([]);
      setRunStats({ ofe: BASE_STAT, def: BASE_STAT, man: BASE_STAT });
      setRunEvents([]);
      setScreen('run-play');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar entrenamiento.');
    } finally {
      setLoading(false);
    }
  };

  // Training Run Turn Progression
  const handleTrainTurn = (advisorId: string, choice: 'OFE' | 'DEF' | 'MAN') => {
    const nextTurn = currentTurn + 1;
    const advisor = advisors.find(a => a.id === advisorId)!;
    
    // Simulate training increment locally
    const baseGain = 5;
    const affinityBonus = advisor.affinity === choice ? 3 : 0;
    const levelBonus = advisor.level;
    const gain = baseGain + affinityBonus + levelBonus;

    const newStats = { ...runStats };
    if (choice === 'OFE') newStats.ofe = Math.min(100, newStats.ofe + gain);
    if (choice === 'DEF') newStats.def = Math.min(100, newStats.def + gain);
    if (choice === 'MAN') newStats.man = Math.min(100, newStats.man + gain);

    // Roll deterministic event using local PRNG
    const prng = new PRNG(runSeed);
    for (let t = 0; t <= currentTurn; t++) {
      const eventRoll = prng.nextInt(0, 9);
      if (t === currentTurn && eventRoll < CAMPAIGN_EVENTS.length) {
        const event = CAMPAIGN_EVENTS[eventRoll];
        event.effect(newStats, choice);
        setRunEvents(prev => [
          ...prev,
          { turn: nextTurn, name: event.name, desc: event.description }
        ]);
      }
    }

    newStats.ofe = Math.max(1, Math.min(100, newStats.ofe));
    newStats.def = Math.max(1, Math.min(100, newStats.def));
    newStats.man = Math.max(1, Math.min(100, newStats.man));

    setRunStats(newStats);
    
    const newAction = { consejeroId: advisorId, choice };
    const updatedLog = [...runActionLog, newAction];
    setRunActionLog(updatedLog);

    if (nextTurn === 8) {
      setCurrentTurn(8);
    } else {
      setCurrentTurn(nextTurn);
    }
  };

  const handleSubmitGeneral = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/run/submit', {
        runId,
        actionLog: runActionLog,
        name: generalName,
      });
      await loadUserData();
      setScreen('home');
    } catch (err: any) {
      setError(err.message || 'Error al acuñar el general.');
    } finally {
      setLoading(false);
    }
  };

  // PvP Arena Matchmaking Lobby
  const handlePvpSetup = () => {
    setJugarModalOpen(false);
    setScreen('pvp');
  };

  const handleStartBattle = () => {
    if (!selectedGeneralId) return;
    setIsSearchingRival(true);
    setError(null);
    
    // Simulate brief searching match animation
    setTimeout(async () => {
      try {
        const response = await api.post<{ battleResult: BattleResult; rewards: any }>('/api/pvp/battle', {
          attackerId: selectedGeneralId,
        });

        setActiveBattle(response.battleResult);
        setBattleRewards(response.rewards);
        
        const genA = response.battleResult.generalA;
        const genB = response.battleResult.generalB;
        const hpA = 100 + genA.stats.def * 3 + genA.stats.man * 2;
        const hpB = 100 + genB.stats.def * 3 + genB.stats.man * 2;

        setBattleHp({ hpA, hpB, maxA: hpA, maxB: hpB });
        setCurrentRoundIndex(-1);
        setCombatFinished(false);
        setScreen('pvp-combat');
      } catch (err: any) {
        setError(err.message || 'Error al emparejar rival.');
      } finally {
        setIsSearchingRival(false);
      }
    }, 1500);
  };

  // Play Event daily combat
  const handleDailyEventBattle = async () => {
    if (generals.length === 0) {
      setScreen('pvp'); // Will show empty state
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Direct battle simulation hook with a seeded boss opponent
      const response = await api.post<{ battleResult: BattleResult; rewards: any }>('/api/pvp/battle', {
        attackerId: selectedGeneralId || generals[0].id,
      });

      setActiveBattle(response.battleResult);
      setBattleRewards({
        goldEarned: response.rewards.goldEarned + 100, // Daily event bonus!
        scoreEarned: response.rewards.scoreEarned + 5
      });
      
      const genA = response.battleResult.generalA;
      const genB = response.battleResult.generalB;
      const hpA = 100 + genA.stats.def * 3 + genA.stats.man * 2;
      const hpB = 100 + genB.stats.def * 3 + genB.stats.man * 2;

      setBattleHp({ hpA, hpB, maxA: hpA, maxB: hpB });
      setCurrentRoundIndex(-1);
      setCombatFinished(false);
      setScreen('pvp-combat');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar combate diario.');
    } finally {
      setLoading(false);
    }
  };

  // Play Sample Replay
  const handlePlayReplay = (general: General) => {
    setError(null);
    setLoading(true);
    // Simulate a self-battle replay
    setTimeout(() => {
      setLoading(false);
      // Construct a mock self-combat
      const mockRound: BattleRound = {
        round: 1,
        attackerId: general.id,
        defenderId: 'npc_dummy',
        attackerHpBefore: 120,
        defenderHpBefore: 120,
        damage: 30,
        attackerHpAfter: 120,
        defenderHpAfter: 90,
        log: `${general.name} ejecuta un golpe devastador infligiendo 30 de daño.`
      };
      
      const mockResult: BattleResult = {
        battleId: 'replay_mock',
        winnerId: general.id,
        rounds: [mockRound],
        seed: '1234',
        generalA: general,
        generalB: {
          ...general,
          id: 'npc_dummy',
          name: 'Entrenador de Práctica',
          power: Math.max(100, general.power - 20)
        }
      };

      setActiveBattle(mockResult);
      setBattleRewards({ goldEarned: 0, scoreEarned: 0 });
      setBattleHp({ hpA: 120, hpB: 120, maxA: 120, maxB: 120 });
      setCurrentRoundIndex(-1);
      setCombatFinished(false);
      setScreen('pvp-combat');
    }, 500);
  };

  // Battle Animation progression
  const handleNextRound = () => {
    if (!activeBattle) return;
    const nextIndex = currentRoundIndex + 1;
    if (nextIndex < activeBattle.rounds.length) {
      const round = activeBattle.rounds[nextIndex];
      setBattleHp(prev => {
        const isAttackerA = round.attackerId === activeBattle.generalA.id;
        return {
          ...prev,
          hpA: isAttackerA ? round.attackerHpAfter : round.defenderHpAfter,
          hpB: isAttackerA ? round.defenderHpAfter : round.attackerHpAfter,
        };
      });
      setCurrentRoundIndex(nextIndex);
    } else {
      setCombatFinished(true);
      loadUserData();
    }
  };

  const handleAutoplayBattle = () => {
    if (!activeBattle) return;
    let index = currentRoundIndex;
    const interval = setInterval(() => {
      index++;
      if (index < activeBattle.rounds.length) {
        const round = activeBattle.rounds[index];
        setBattleHp(prev => {
          const isAttackerA = round.attackerId === activeBattle.generalA.id;
          return {
            ...prev,
            hpA: isAttackerA ? round.attackerHpAfter : round.defenderHpAfter,
            hpB: isAttackerA ? round.defenderHpAfter : round.attackerHpAfter,
          };
        });
        setCurrentRoundIndex(index);
      } else {
        clearInterval(interval);
        setCombatFinished(true);
        loadUserData();
      }
    }, 1000);
  };

  // Leaderboard fetch
  const handleViewLeaderboard = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<any>(`/api/pvp/leaderboard?page=${page}&limit=8`);
      setLeaderboard(response.leaderboard);
      setLbPage(page);
    } catch (err: any) {
      setError(err.message || 'Error al cargar clasificación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleViewLeaderboard(1);
  }, []);

  const getTierLetter = (tier: number) => {
    if (tier === 1) return 'E';
    if (tier === 2) return 'D';
    if (tier === 3) return 'C';
    if (tier === 4) return 'B';
    return 'A';
  };

  return (
    <div className="game-screen retro-box">
      
      {/* ERROR ALERT */}
      {error && (
        <div className="retro-header-bar" style={{ backgroundColor: '#cc3333', fontSize: '0.85rem' }}>
          ⚠️ ERROR: {error}
          <button style={{ float: 'right', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }} onClick={() => setError(null)}><Icon src={ICON.close} /></button>
        </div>
      )}

      {/* SERVER LOADING */}
      {loading && (
        <div className="retro-loading-overlay">
          <div className="retro-spinner"></div>
          <div style={{ color: '#fff', fontSize: '1rem', letterSpacing: '1px' }}>PROCESANDO...</div>
        </div>
      )}

      {/* TOP HEADER STATUS BAR (solo en Home, como el mockup) */}
      {screen === 'home' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="res-pill gold">
              <Icon src={ICON.gold} />
              <span>${profile ? profile.gold : 120} oro</span>
            </span>
            <span className="res-pill adv">
              <Icon src={ICON.shield} />
              <span>{advisors.length} consejeros</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: '#6b6258', fontFamily: 'var(--font-body)' }}>{userId}</span>
            <button className="retro-btn-grey icon-btn" onClick={() => setOptionsModalOpen(true)} title="Opciones"><Icon src={ICON.gear} /></button>
          </div>
        </div>
      )}

      {/* SCREEN: HOME (Idle State) */}
      {screen === 'home' && (
        <>
          <div className="retro-header-bar">
            CAMPO DE ENTRENAMIENTO
          </div>

          {/* Pixel Field */}
          <div className="pixel-field">
            {/* Animated Clouds */}
            <div className="pixel-cloud-1" style={{ backgroundImage: `url(${SPRITE.cloud1})` }}></div>
            <div className="pixel-cloud-2" style={{ backgroundImage: `url(${SPRITE.cloud2})` }}></div>

            {/* Background Buildings */}
            <div className="pixel-castle" style={{ backgroundImage: `url(${SPRITE.castle})` }}></div>
            <div className="pixel-tower" style={{ backgroundImage: `url(${SPRITE.tower})` }}></div>
            <div className="pixel-barracks" style={{ backgroundImage: `url(${SPRITE.barracks})` }}></div>

            {/* Puffing smoke */}
            <div className="smoke-cloud" style={{ top: '30px', left: '30px' }}></div>
            <div className="smoke-cloud" style={{ top: '20px', right: '40px', animationDelay: '1.2s' }}></div>

            {/* Interactive Gold resources instead of wooden dummy */}
            <div className="pixel-gold-resource" style={{ left: '130px', backgroundImage: `url(${SPRITE.goldResource})` }}></div>
            <div className="pixel-gold-resource" style={{ right: '110px', backgroundImage: `url(${SPRITE.goldResource})` }}></div>

            {/* Sparring Knights using real animated sprites */}
            <div className="sprite-warrior-blue-idle" style={{ position: 'absolute', bottom: '15px', left: '38%', transform: 'scale(0.8)', backgroundImage: `url(${SPRITE.warriorBlue})` }}></div>
            <div className="sprite-warrior-red-idle" style={{ position: 'absolute', bottom: '15px', right: '38%', transform: 'scale(0.8) scaleX(-1)', backgroundImage: `url(${SPRITE.warriorRed})` }}></div>
          </div>

          {/* Navigation Controls bottom cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
            <button className="retro-btn-grey corner-nav" onClick={() => setScreen('coleccion')}>
              <span>COLECCIÓN</span>
              <span className="corner-sub">🛡️ ⚔️</span>
            </button>

            <button className="retro-btn btn-jugar" style={{ minWidth: '190px' }} onClick={() => setJugarModalOpen(true)}>
              &gt;&gt; JUGAR
            </button>

            <button className="retro-btn-grey corner-nav" onClick={() => setScreen('eventos')}>
              <span>EVENTOS</span>
              <span className="corner-sub">🏆 ⏱️</span>
            </button>
          </div>
        </>
      )}

      {/* MODAL: JUGAR CLICKED (Blurred overlay) */}
      {jugarModalOpen && (
        <div className="retro-modal-backdrop">
          <div className="retro-modal">
            <h3 style={{ textTransform: 'uppercase', marginBottom: '8px', color: '#fff' }}>¿Qué quieres hacer?</h3>
            
            <button className="retro-btn-grey" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'flex-start' }} onClick={handleStartTrainingSetup}>
              <Icon src={ICON.sword} className="lg" /> )==&gt; CORRER RUN
            </button>

            <button className="retro-btn-grey" style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'flex-start' }} onClick={handlePvpSetup}>
              <Icon src={ICON.shield} className="lg" /> (D) PVP / ARENA
            </button>

            <button style={{ background: 'none', border: 'none', color: '#c8e646', cursor: 'pointer', fontSize: '0.9rem', marginTop: '12px', textDecoration: 'underline' }} onClick={() => setJugarModalOpen(false)}>
              [ x cerrar ]
            </button>
          </div>
        </div>
      )}

      {/* MODAL: OPTIONS / IDENTITY SWITCHER */}
      {optionsModalOpen && (
        <div className="retro-modal-backdrop">
          <div className="retro-modal" style={{ maxWidth: '450px' }}>
            <h3 style={{ textTransform: 'uppercase', marginBottom: '12px', color: '#fff' }}>Opciones / Cambiar Cuenta</h3>
            <p style={{ fontSize: '0.75rem', color: '#b0b0b8', textAlign: 'left', lineHeight: '1.3', marginBottom: '12px' }}>
              Modifica el ID de usuario para cargar o crear un perfil alternativo y probar el emparejamiento local.
            </p>
            
            <input 
              type="text" 
              className="retro-input" 
              value={tempUserId} 
              onChange={e => setTempUserId(e.target.value)} 
              placeholder="t2_nombre" 
              style={{ marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="retro-btn" onClick={handleUserChange}>CONECTAR</button>
              <button className="retro-btn-grey" onClick={() => setOptionsModalOpen(false)}>CERRAR</button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN: COLECCIÓN (Tabbed Advisor & Generals View) */}
      {screen === 'coleccion' && (
        <>
          <div className="screen-topbar">
            <button className="retro-btn-grey" style={{ padding: '8px 12px' }} onClick={() => setScreen('home')}>
              &lt; VOLVER
            </button>
            <span className="screen-title">COLECCIÓN</span>
            <button className="retro-btn-grey icon-btn" onClick={() => setOptionsModalOpen(true)} title="Opciones"><Icon src={ICON.gear} /></button>
          </div>

          <div className="retro-tab-container">
            <button className={`retro-tab-button ${activeTab === 'consejeros' ? 'active' : ''}`} onClick={() => setActiveTab('consejeros')}>
              [ CONSEJEROS ]
            </button>
            <button className={`retro-tab-button ${activeTab === 'generales' ? 'active' : ''}`} onClick={() => setActiveTab('generales')}>
              [ GENERALES ]
            </button>
          </div>

          {activeTab === 'consejeros' && (
            <div className="retro-container">
              <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '0.9rem' }}>
                Consejeros {advisors.length} / 12
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {advisors.map((c, idx) => (
                  <div 
                    key={c.id} 
                    className="retro-portrait-box" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setUpgradeAdvisor(c)}
                  >
                    <div className={`retro-portrait-avatar aff-${c.affinity}`}>
                      <img className="avatar-img" src={avatarFor(c.id)} alt="" draggable={false} />
                    </div>
                    <span className={`aff-badge aff-${c.affinity}`}>{c.affinity}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
                      Lv{c.level}
                    </span>
                    <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
                      {c.name.split(' ')[0]}
                    </span>
                  </div>
                ))}

                {/* Draw blocked slots */}
                {Array.from({ length: Math.max(0, 12 - advisors.length) }).map((_, idx) => (
                  <div key={`blocked-${idx}`} className="retro-portrait-box" style={{ opacity: 0.5 }}>
                    <div className="retro-portrait-avatar" style={{ backgroundColor: '#888' }}>
                      🔒
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#555' }}>???</span>
                    <span style={{ fontSize: '0.65rem', color: '#555' }}>bloq.</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.7rem', borderTop: '2px solid black', marginTop: '12px', paddingTop: '8px', color: '#444', textAlign: 'center' }}>
                tap consejero -&gt; subir nivel (gasta $)
              </div>
            </div>
          )}

          {activeTab === 'generales' && (
            <div className="retro-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '0.9rem' }}>
                FORGED GENERALES ({generals.length})
              </div>

              {generals.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.8rem', color: '#585860' }}>
                  Sin generales en el cuartel. ¡Corre una run para reclutar!
                </div>
              ) : (
                generals.map(g => (
                  <div key={g.id} className="retro-container" style={{ backgroundColor: '#d8d8d8', padding: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="retro-portrait-avatar" style={{ backgroundColor: '#a8a8b0', width: '56px', height: '56px' }}>
                      <img className="avatar-img" src={avatarFor(g.id)} alt="" draggable={false} />
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        <span>{g.name}</span>
                        <span>{g.power}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#444' }}>
                        Tier: {getTierLetter(g.tier)} | Power: {g.power} | OFE/DEF/MAN
                      </div>
                      
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <button className="retro-btn" style={{ padding: '4px 8px', fontSize: '0.65rem' }} onClick={() => handlePlayReplay(g)}>
                          [ replay ]
                        </button>
                        <button className="retro-btn" style={{ padding: '4px 8px', fontSize: '0.65rem' }} onClick={() => { setSelectedGeneralId(g.id); setScreen('pvp'); }}>
                          [ a la arena ]
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* UPGRADE ADVISOR DIALOG MODAL */}
          {upgradeAdvisor && (
            <div className="retro-modal-backdrop">
              <div className="retro-modal">
                <div className={`retro-portrait-avatar aff-${upgradeAdvisor.affinity}`} style={{ margin: '0 auto', width: '72px', height: '72px' }}>
                  <img className="avatar-img" src={avatarFor(upgradeAdvisor.id)} alt="" draggable={false} />
                </div>
                <h3 style={{ textTransform: 'uppercase', color: '#fff', fontSize: '1rem' }}>{upgradeAdvisor.name}</h3>
                <p style={{ fontSize: '0.8rem', color: '#b0b0b8', margin: '8px 0' }}>
                  Nivel actual: {upgradeAdvisor.level} (Afinidad: {upgradeAdvisor.affinity})
                </p>
                
                <div style={{ margin: '12px 0', fontWeight: 'bold' }}>
                  Costo de Mejora: <Icon src={ICON.gold} /> {upgradeAdvisor.level * 150} oro
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button 
                    className="retro-btn" 
                    onClick={handleLevelAdvisorSubmit}
                    disabled={profile ? profile.gold < (upgradeAdvisor.level * 150) : true}
                  >
                    MEJORAR
                  </button>
                  <button className="retro-btn-grey" onClick={() => setUpgradeAdvisor(null)}>
                    CARRAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* SCREEN: EVENTOS (Daily Boss & Specials) */}
      {screen === 'eventos' && (
        <>
          <div className="screen-topbar">
            <button className="retro-btn-grey" style={{ padding: '8px 12px' }} onClick={() => setScreen('home')}>
              &lt; VOLVER
            </button>
            <span className="screen-title">EVENTOS</span>
            <button className="retro-btn-grey icon-btn" onClick={() => setOptionsModalOpen(true)} title="Opciones"><Icon src={ICON.gear} /></button>
          </div>

          <div className="retro-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Daily Combat */}
            <div className="retro-container" style={{ backgroundColor: '#d8d8d8', borderLeft: '6px solid var(--retro-header)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>
                <span><Icon src={ICON.shield} /> COMBATE DIARIO</span>
                <span style={{ color: '#555' }}>reset 14:32</span>
              </div>
              <p style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Enemy: Orden Carmesí</p>
              <p style={{ fontSize: '0.7rem', color: '#555', marginBottom: '10px' }}>Modif.: doctrina de caballería | Premio: $$ + chance consejero</p>
              
              <button className="retro-btn" style={{ width: '100%' }} onClick={handleDailyEventBattle}>
                [ JUGAR COMBATE DIARIO ]
              </button>
            </div>

            {/* Specials */}
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '8px', color: '#fff' }}>
                ESPECIALES (tiempo limitado)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                
                <div className="retro-container" style={{ backgroundColor: '#d0d0d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px' }}>
                  <div style={{ fontSize: '0.7rem' }}>
                    <strong>[RUN] Torneo de Reclutas</strong>
                    <div style={{ color: '#555' }}>sube un general, reglas fijas. (2d4h)</div>
                  </div>
                  <button className="retro-btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={handleStartTrainingSetup}>
                    [ ENTRAR ]
                  </button>
                </div>

                <div className="retro-container" style={{ backgroundColor: '#d0d0d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px' }}>
                  <div style={{ fontSize: '0.7rem' }}>
                    <strong>[COMBATE] Asedio Frontera</strong>
                    <div style={{ color: '#555' }}>arena rankeada vs jugadores. (18h)</div>
                  </div>
                  <button className="retro-btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={handlePvpSetup}>
                    [ ENTRAR ]
                  </button>
                </div>

              </div>
            </div>

          </div>
        </>
      )}

      {/* SCREEN: RUN SETUP (Advisor loadout and general naming) */}
      {screen === 'run-setup' && (
        <>
          <div className="screen-topbar">
            <button className="retro-btn-grey" style={{ padding: '8px 12px' }} onClick={() => setScreen('home')}>
              &lt; VOLVER
            </button>
            <span className="screen-title">NUEVA RUN</span>
            <button className="retro-btn-grey icon-btn" onClick={() => setOptionsModalOpen(true)} title="Opciones"><Icon src={ICON.gear} /></button>
          </div>

          <div className="retro-container">
            {/* Advisor Selection grid */}
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>
              1. ELIGE 3 CONSEJEROS {selectedSetupAdvisors.length}/3
            </div>

            <div className="retro-grid-3" style={{ marginBottom: '16px' }}>
              {advisors.slice(0, 3).map((c, idx) => {
                const isSelected = selectedSetupAdvisors.includes(c.id);
                return (
                  <div 
                    key={c.id} 
                    className={`retro-portrait-box ${isSelected ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedSetupAdvisors(prev => prev.filter(id => id !== c.id));
                      } else if (selectedSetupAdvisors.length < 3) {
                        setSelectedSetupAdvisors(prev => [...prev, c.id]);
                      }
                    }}
                  >
                    <div className={`retro-portrait-avatar aff-${c.affinity}`}>
                      <img className="avatar-img" src={avatarFor(c.id)} alt="" draggable={false} />
                    </div>
                    <span className={`aff-badge aff-${c.affinity}`}>{c.affinity}</span>
                    <span style={{ fontSize: '0.7rem' }}>{c.name.split(' ')[0]}</span>
                  </div>
                );
              })}

              {/* Draw empty selection cards if needed */}
              {Array.from({ length: Math.max(0, 3 - selectedSetupAdvisors.length) }).map((_, idx) => (
                <div key={`empty-choice-${idx}`} className="retro-portrait-box" style={{ borderStyle: 'dashed' }}>
                  <div className="retro-portrait-avatar" style={{ backgroundColor: '#aaa' }}>
                    +
                  </div>
                  <span style={{ fontSize: '0.7rem' }}>elige</span>
                </div>
              ))}
            </div>

            {/* Naming General input */}
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>
              2. NOMBRA A TU GENERAL
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input 
                type="text" 
                className="retro-input" 
                placeholder="Aldric..." 
                value={generalName}
                onChange={e => setGeneralName(e.target.value)}
              />
              <button className="retro-btn-grey" onClick={handleRandomizeName}>
                [rnd]
              </button>
            </div>

            <button 
              className="retro-btn" 
              style={{ width: '100%', padding: '14px' }} 
              onClick={handleStartTrainingRun}
              disabled={selectedSetupAdvisors.length < 3 || !generalName.trim()}
            >
              &gt;&gt; COMENZAR RUN
            </button>
          </div>
        </>
      )}

      {/* SCREEN: RUN PLAY (8-turn campaign training) */}
      {screen === 'run-play' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Campamento: {generalName}</span>
            <div className="retro-container" style={{ padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#fff', fontWeight: 'bold' }}>
              Turno {currentTurn}/8
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px' }}>
            
            {/* Center Choices */}
            <div className="retro-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentTurn < 8 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', lineHeight: '1.3', flex: 1 }}>
                      Selecciona una especialidad militar para entrenar. El consejero correspondiente sumará sus bonos:
                    </p>
                    <div className="sprite-warrior-blue-idle" style={{ transform: 'scale(0.85)', marginLeft: '10px', backgroundImage: `url(${SPRITE.warriorBlue})` }}></div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {advisors.filter(a => selectedSetupAdvisors.includes(a.id)).map(c => (
                      <div key={c.id} className="retro-container" style={{ backgroundColor: '#d8d8d8', padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.7rem' }}>
                          <strong>{c.name.split(' ')[0]} (Lv{c.level})</strong>
                          <div style={{ color: '#555' }}>Afinidad: {c.affinity}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="retro-btn" style={{ padding: '6px', fontSize: '0.65rem' }} onClick={() => handleTrainTurn(c.id, 'OFE')}><Icon src={ICON.sword} /> OFE</button>
                          <button className="retro-btn" style={{ padding: '6px', fontSize: '0.65rem' }} onClick={() => handleTrainTurn(c.id, 'DEF')}><Icon src={ICON.shield} /> DEF</button>
                          <button className="retro-btn" style={{ padding: '6px', fontSize: '0.65rem' }} onClick={() => handleTrainTurn(c.id, 'MAN')}>👑 MAN</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                  <div style={{ fontSize: '2.5rem' }}>🎖️</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>¡Entrenamiento Terminado!</h3>
                    <p style={{ fontSize: '0.7rem', color: '#555', marginTop: '6px', lineHeight: '1.3' }}>
                      Tu recluta ha completado los 8 turnos. Acuña la unidad inmutable para enviarla al combate.
                    </p>
                  </div>
                  <button className="retro-btn" style={{ width: '100%', padding: '14px' }} onClick={handleSubmitGeneral}>
                    🎖️ Acuñar General
                  </button>
                </div>
              )}
            </div>

            {/* Stats Column */}
            <div className="retro-container panel-paper" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '4px' }}>
                ESTADÍSTICAS
              </div>
              
              <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>OFE: <strong>{runStats.ofe}</strong></div>
                <div>DEF: <strong>{runStats.def}</strong></div>
                <div>MAN: <strong>{runStats.man}</strong></div>
                <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed black' }}>
                  Poder: <strong style={{ color: '#78242f' }}>{calculatePower(runStats)}</strong>
                </div>
              </div>

              {/* Mini Events List */}
              <div style={{ flex: 1, borderTop: '2px solid black', marginTop: '8px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>EVENTOS:</span>
                {runEvents.map((ev, index) => (
                  <div key={index} style={{ fontSize: '0.6rem', color: '#333', borderBottom: '1px solid #c0c0c0', paddingBottom: '2px' }}>
                    T{ev.turn}: {ev.name}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      {/* SCREEN: PVP match select */}
      {screen === 'pvp' && (
        <>
          <div className="screen-topbar">
            <button className="retro-btn-grey" style={{ padding: '8px 12px' }} onClick={() => setScreen('home')}>
              &lt; VOLVER
            </button>
            <span className="screen-title">PVP / ARENA</span>
            <button className="retro-btn-grey icon-btn" onClick={() => setOptionsModalOpen(true)} title="Opciones"><Icon src={ICON.gear} /></button>
          </div>

          {generals.length === 0 ? (
            /* Empty State A */
            <div className="retro-container" style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.3' }}>
                <div>(-_-)</div>
                <div>(-_-)</div>
                <div style={{ marginTop: '8px' }}>sin generales todavía</div>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#444', lineHeight: '1.3' }}>
                En quianes renoc requireso un penesemo. Necesitas un comandante entrenado para entrar al PvP.
              </p>
              
              <button className="retro-btn" onClick={handleStartTrainingSetup}>
                )==&gt; CORRER RUN
              </button>
            </div>
          ) : (
            /* Non-empty State B */
            <div className="retro-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* My General Selection info */}
              <div className="retro-container" style={{ backgroundColor: '#d8d8d8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '8px' }}>
                  <span>TU GENERAL</span>
                  <span>ranking #142</span>
                </div>
                
                {generals.find(g => g.id === selectedGeneralId) && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="retro-portrait-avatar" style={{ backgroundColor: '#aaa' }}>
                      <img className="avatar-img" src={avatarFor(generals.find(g => g.id === selectedGeneralId)!.id)} alt="" draggable={false} />
                    </div>
                    <div style={{ fontSize: '0.75rem' }}>
                      <strong>{generals.find(g => g.id === selectedGeneralId)!.name}</strong>
                      <div>
                        Tier {getTierLetter(generals.find(g => g.id === selectedGeneralId)!.tier)} | Poder: {generals.find(g => g.id === selectedGeneralId)!.power}
                      </div>
                      <div>
                        OFE/DEF/MAN: {generals.find(g => g.id === selectedGeneralId)!.stats.ofe}/{generals.find(g => g.id === selectedGeneralId)!.stats.def}/{generals.find(g => g.id === selectedGeneralId)!.stats.man}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Matching Rival search banner */}
              <div className="retro-container" style={{ backgroundColor: '#b8b8c0', textAlign: 'center', padding: '16px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '6px' }}>RIVAL</div>
                {isSearchingRival ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div className="retro-spinner" style={{ width: '24px', height: '24px' }}></div>
                    <span style={{ fontSize: '0.7rem' }}>buscando oponente... (fantasma/NPC)</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#444' }}>¿Listo para el desafío de la Arena?</span>
                )}
              </div>

              <button className="retro-btn" style={{ width: '100%', padding: '12px' }} onClick={handleStartBattle} disabled={isSearchingRival}>
                (D) BUSCAR RIVAL
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Cambiar General:</label>
                <select 
                  className="retro-input" 
                  value={selectedGeneralId}
                  onChange={e => setSelectedGeneralId(e.target.value)}
                  style={{ flex: 1, padding: '4px', fontSize: '0.75rem' }}
                >
                  {generals.map(g => (
                    <option key={g.id} value={g.id}>{g.name} (Poder: {g.power})</option>
                  ))}
                </select>
              </div>

            </div>
          )}
        </>
      )}

      {/* SCREEN: PVP combat arena visor */}
      {screen === 'pvp-combat' && activeBattle && (
        <>
          <div className="retro-header-bar">
            ⚔️ COMBATE DE ARENA ⚔️
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
            <div className="retro-container" style={{ padding: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>ATACANTE</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '6px 0' }}>
                <div className="retro-portrait-avatar" style={{ width: '48px', height: '48px', backgroundColor: '#a83b34' }}>
                  <img className="avatar-img" src={avatarFor(activeBattle.generalA.id)} alt="" draggable={false} />
                </div>
                <div className="sprite-warrior-blue-idle" style={{ transform: 'scale(1)', backgroundImage: `url(${SPRITE.warriorBlue})` }}></div>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{activeBattle.generalA.name}</div>
              <div className="hp-track" style={{ marginTop: '4px', width: '100%' }}>
                <div className={`hp-fill ${battleHp.hpA / battleHp.maxA < 0.3 ? 'low' : ''}`} style={{ width: `${Math.max(0, (battleHp.hpA / battleHp.maxA) * 100)}%` }}></div>
              </div>
              <div style={{ fontSize: '0.65rem', marginTop: '2px' }}>{Math.max(0, battleHp.hpA)}/{battleHp.maxA}</div>
            </div>

            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: 'var(--danger)' }}>VS</div>

            <div className="retro-container" style={{ padding: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>DEFENSOR</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '6px 0' }}>
                <div className="sprite-warrior-red-idle" style={{ transform: 'scale(1) scaleX(-1)', backgroundImage: `url(${SPRITE.warriorRed})` }}></div>
                <div className="retro-portrait-avatar" style={{ width: '48px', height: '48px', backgroundColor: '#2f6aa3' }}>
                  <img className="avatar-img" src={avatarFor(activeBattle.generalB.id)} alt="" draggable={false} style={{ transform: 'scaleX(-1)' }} />
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{activeBattle.generalB.name}</div>
              <div className="hp-track" style={{ marginTop: '4px', width: '100%' }}>
                <div className={`hp-fill ${battleHp.hpB / battleHp.maxB < 0.3 ? 'low' : ''}`} style={{ width: `${Math.max(0, (battleHp.hpB / battleHp.maxB) * 100)}%` }}></div>
              </div>
              <div style={{ fontSize: '0.65rem', marginTop: '2px' }}>{Math.max(0, battleHp.hpB)}/{battleHp.maxB}</div>
            </div>
          </div>

          {/* Round playback logs */}
          <div className="retro-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                Ronda {currentRoundIndex + 1} / {activeBattle.rounds.length}
              </span>
              {!combatFinished ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="retro-btn" style={{ padding: '4px 8px', fontSize: '0.65rem' }} onClick={handleNextRound}>
                    <Icon src={ICON.arrowGreen} /> Siguiente
                  </button>
                  <button className="retro-btn" style={{ padding: '4px 8px', fontSize: '0.65rem' }} onClick={handleAutoplayBattle}>
                    ⏩ Auto
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'green' }}>TERMINADO</span>
              )}
            </div>

            <div style={{ backgroundColor: '#fff', border: '2px solid black', padding: '12px', fontSize: '0.75rem', color: '#000', minHeight: '80px' }}>
              {currentRoundIndex === -1 ? (
                <span>Comenzando batalla. Se calcula iniciativa en base a Mando...</span>
              ) : (
                activeBattle.rounds[currentRoundIndex].log
              )}
            </div>

            {combatFinished && (
              <div className="retro-container" style={{ backgroundColor: '#d8f0d8', border: '3px solid black', marginTop: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#78242f' }}>
                  {activeBattle.winnerId === activeBattle.generalA.id ? '🏆 ¡VICTORIA ATACANTE!' : '💀 VICTORIA DEFENSOR'}
                </div>
                
                <div style={{ fontSize: '0.75rem' }}>
                  Recompensa: <Icon src={ICON.gold} /> +{battleRewards.goldEarned} oro | PTS: +{battleRewards.scoreEarned}
                </div>

                <button className="retro-btn" style={{ margin: '4px auto 0 auto' }} onClick={() => setScreen('home')}>
                  Cerrar e Ir al Inicio
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* CLASIFICACIÓN LEADERBOARD — solo en Arena (PvP) */}
      {screen === 'pvp' && (
        <div className="retro-container" style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '2px solid black', paddingBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>🏆 LEADERBOARD SEASON 1</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="retro-btn" style={{ padding: '2px 6px', fontSize: '0.6rem' }} onClick={() => handleViewLeaderboard(lbPage - 1)} disabled={lbPage === 1}>&lt;</button>
              <span style={{ fontSize: '0.65rem', alignSelf: 'center' }}>Pág {lbPage}</span>
              <button className="retro-btn" style={{ padding: '2px 6px', fontSize: '0.6rem' }} onClick={() => handleViewLeaderboard(lbPage + 1)} disabled={leaderboard.length < 8}>&gt;</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
            {leaderboard.length === 0 ? (
              <span style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>Cargando ranking...</span>
            ) : (
              leaderboard.map((item, idx) => {
                const rank = (lbPage - 1) * 8 + idx + 1;
                return (
                  <div key={item.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '2px 4px', backgroundColor: item.userId === userId ? '#e8ffd8' : 'none', color: '#000' }}>
                    <span>#{rank} {item.name.substring(0, 16)} {item.userId === userId ? '(Tú)' : ''}</span>
                    <strong>{item.score} PTS</strong>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}
