import {For, render, Show} from 'solid-js/web';
import {createComputed, createEffect, createMemo, createSignal, onMount} from 'solid-js';
import {createStore, unwrap} from "solid-js/store";
import {chain, generateWord, limitChars} from '../util/markov';

type KeyPressData = {
    hitTotalTime: number;
    hitCount: number;
    missCount: number;
    totalCount: number;
}

// Colemak DH
// const keyOrder = "tnseriaodhzyqucgwxmfvjplkb".split('')
// Qwerty
const keyOrder = "fjdkslavnieowqhpcgzvmxtnyb".split('')

const WordDisplay = () => {
    const [previousLetters, setPreviousLetters] = createStore<string[]>([]);
    const [nextLetters, setNextLetters] = createStore<string[]>([]);
    const [nextWords, setNextWords] = createStore<string[]>([]);
    const [lastKeyStarted, setLastKeyStarted] = createSignal(performance.now());
    
    const [keyStats, setKeyStats] = createStore<Record<string, KeyPressData>>({});
    
    const [textValue, setTextValue] = createSignal('');
    const [paused, setPaused] = createSignal(true);
    
    const [strengthenChars, setStrengthenChars] = createSignal<string[]>([])
    
    const [availableKeys, setAvailableKeys] = createSignal(keyOrder.slice(0, 2));
    
    const computedKeyStats = createMemo(() => {
        const keys = [];
        
        for (let key of Object.keys(keyStats)) {
            keys.push({
                key,
                hits: keyStats[key].hitCount,
                wpm: (1000 / (keyStats[key].hitTotalTime / keyStats[key].hitCount)) * 60 / 5,
                accuracy: keyStats[key].hitCount / keyStats[key].totalCount,
            })
        }
        
        return keys.sort((a, b) => {
            if (a.hits < 10) return -1;
            if (b.hits < 10) return 1;
            
            if (a.accuracy === b.accuracy) {
                if (a.wpm === b.wpm) return 0;
                return a.wpm < b.wpm ? -1 : 1;
            }
            
            return a.accuracy < b.accuracy ? -1 : 1;
        });
    });

    chain.then(c => {
        // c = limitChars(c, 'hyvwr'.split(''))
        const markovChain = createMemo(() => {
            return limitChars(c, availableKeys());
        });
        
        const newWord = generateWord(markovChain(), [], 6, 12);
        
        setNextLetters([...newWord.split('')]);
        
        const moreWords = Array.from({ length: 2 }, () => generateWord(markovChain(), [], 6, 12));
        setNextWords(moreWords);
        
        createEffect(() => {
            const remainingCount = nextWords.length;
            
            if (remainingCount < 2) {
                // Check if we should introduce a new character yet
                const lowestAccuracy = computedKeyStats().reduce((a, b) => Math.min(a, b.accuracy), 1);
                const lowestWpm = computedKeyStats().reduce((a, b) => Math.min(a, b.wpm), 999);
                const lowestHits = computedKeyStats().reduce((a, b) => Math.min(a, b.hits), 999);
                
                if (lowestAccuracy > 0.8 && lowestWpm > 25 && lowestHits > 10 && keyOrder.length > availableKeys().length) {
                    const newKey = keyOrder[availableKeys().length];
                    
                    setKeyStats(newKey, (existing): KeyPressData => {
                        return existing ?? { hitCount: 0, hitTotalTime: 0, missCount: 0, totalCount: 0 };
                    })

                    setAvailableKeys([...availableKeys(), newKey])
                }
                
                if (computedKeyStats().length > 3) {
                    setStrengthenChars(computedKeyStats().slice(0, 3).map(k => k.key))
                }

                const newWord = generateWord(markovChain(), strengthenChars(), 6, 12);
                setNextWords([...nextWords, newWord])
            }
        });
    })
    
    const onInput = (event: InputEvent) => {
        const now = performance.now();
        const key = (event.currentTarget as HTMLInputElement).value
        const timeTaken = now - lastKeyStarted();
        setLastKeyStarted(now);
        
        setTextValue(' ');
        setTextValue('');

        // Missed a key
        if (nextLetters.length > 0 && nextLetters[0] !== key) {
            setKeyStats(nextLetters[0], (existing): KeyPressData => {
                let o = existing ?? { hitCount: 0, hitTotalTime: 0, missCount: 0, totalCount: 0 };
                return {
                    ...o,
                    missCount: o.missCount + 1,
                    totalCount: o.totalCount + 1,
                };
            })
        }

        if (nextLetters.length > 0 && nextLetters[0] === key) {
            setNextLetters(nextLetters.slice(1));
            setPreviousLetters([...previousLetters, key])

            // ignore super long keypresses
            if (timeTaken < 3000) {
                setKeyStats(key, (existing): KeyPressData => {
                    let o = existing ?? { hitCount: 0, hitTotalTime: 0, missCount: 0, totalCount: 0 };
                    return {
                        ...o,
                        hitTotalTime: o.hitTotalTime + timeTaken,
                        hitCount: o.hitCount + 1,
                        totalCount: o.totalCount + 1,
                    };
                })
                console.log(unwrap(keyStats));
            }
        }
        
        if (nextLetters.length === 0 && nextWords.length > 0 && key === ' ') {
            const nextWord = nextWords[0];
            setNextWords(nextWords.slice(1));
            setNextLetters(nextWord.split(''))
            setPreviousLetters([...previousLetters, ' '])
        }
    }
    
    let typeInputRef: HTMLInputElement | undefined;
    const focus = () => {
        typeInputRef?.focus()
    }
    
    onMount(() => { focus() })
    
    return <div onClick={focus} classList={ { ['blur-sm']: paused(), 'text-2xl': true } } class="w-1/2">
        <input
            type="text"
            ref={typeInputRef}
            onBlur={() => setPaused(true)}
            onFocus={() => setPaused(false)}
            value={textValue()}
            onInput={onInput}
            class="sr-only"
        />
        <div class="flex w-full">
            <div class="flex flex-shrink-0 w-1/2 flex-nowrap overflow-x-hidden justify-end">
                    <For each={previousLetters}>
                        {letter => <span class="text-slate-500">
                            <Show when={letter === ' '} keyed={true}>&nbsp;</Show>
                            <Show when={letter !== ' '} keyed={true}>{letter}</Show>
                        </span>}
                    </For>
            </div>
            <div class="flex flex-nowrap overflow-x-hidden flex-shrink-0 w-1/2">
                <span class="relative"><span class="absolute -translate-x-1 text-amber-300 opacity-80">|</span></span>
                <div class="shrink-0">
                    <For each={nextLetters}>
                        {letter => <span>{letter}</span>}
                    </For>
                </div>
                <For each={nextWords}>
                    {word => <>&nbsp;<span>{word}</span></>}
                </For>
            </div>
        </div>
        <div>{JSON.stringify(strengthenChars())}</div>
        <div>
            <For each={availableKeys()}>
                {key => <span class="p-2 border-2 border-slate-300">{key}</span>}
            </For>
                
        </div>
        {/*<Show when={nextWords.length === 0 && nextLetters.length === 0} keyed={true}>*/}
        <div>
            <For each={computedKeyStats()}>
                {key => <div>{key.key} - {Math.round(key.wpm)} wpm, {Math.round(key.accuracy * 100)}%, {key.hits} hits</div>}
            </For>
        </div>
        {/*</Show>*/}
    </div>
}

const Root = () => {
    return <main class="flex justify-center items-center h-full">
        <WordDisplay />
    </main>;
}

export function startSolidApp() {
    render(() => <Root />, document.body)
}
