const SIZE = 3;

type MarkovChain = {
    ngrams: Record<string, Record<string, number>>;
}

function train(chain: MarkovChain, words: string[]) {
    for (let word of words) {
        let ngram = '';

        for (let i = 0; i <= word.length; i++) {
            const nextToken = i === word.length ? 'END' : word.charAt(i);
            chain.ngrams[ngram] = chain.ngrams[ngram] ?? {};
            let followingCharWeight = chain.ngrams[ngram][nextToken] ?? 0;
            followingCharWeight += 1;
            chain.ngrams[ngram][nextToken] = followingCharWeight;

            // Get next ngram
            ngram += nextToken;
            if (ngram.length > SIZE) { 
                ngram = ngram.substring(1);
            }
        }
    }

    return chain;
}

export function limitChars(chain: MarkovChain, chars: string[]): MarkovChain {
    let newChain: MarkovChain = { ngrams: {} };

    for (let ngram of Object.keys(chain.ngrams)) {
        // Skip this ngram if it contains none of the target chars
        if (!ngram.split('').every(c => chars.includes(c))) continue;

        let ngramInfo: Record<string, number> = {};
        for (let nextToken of Object.keys(chain.ngrams[ngram])) {
            if (chars.includes(nextToken) || nextToken == 'END') {
                ngramInfo[nextToken] = chain.ngrams[ngram][nextToken];
            }
        }

        if (Object.keys(ngramInfo).length > 0) {
            newChain.ngrams[ngram] = ngramInfo;
        }

    }
    return newChain;
}

function pickRandomWeight(weights: Record<string, number>, strengthenChars: string[] = []) {
    let sum = 0;
    let entries = Object.entries(weights);

    for (let [_, weight] of entries){ 
        sum += weight;
    }

    const strengthenWeight = sum * 1;

    // Strengthen any of the target characters' weights
    entries = entries.map(([char, weight]) => {
        if (strengthenChars.includes(char)) {
            sum += strengthenWeight
            return [char, weight + strengthenWeight];
        }
        return [char, weight];
    })

    let randVal = Math.random() * sum;

    for (let [char, weight] of entries) {
        randVal -= weight;
        if (randVal < 0) {
            if (char === 'END') return null;

            return char;
        }
    }

    return null;
}

export function generateWord(chain: MarkovChain, strengthenChars: string[], minLength: number, maxLength: number) {
    let word = '';

    while(word.length < maxLength) {
        let ngramInfo;
        let ngram = word;
        while (ngramInfo == null) {
            // console.log('ngram ', ngram)
            if (word.length > minLength && ngram.length < 2) {
                return word;
            }
            ngramInfo = chain.ngrams[ngram];
            ngram = ngram.substring(1);
        }

        // console.log(`picking weight for ${word} ngram ${ngram} from ${JSON.stringify(ngramInfo)}`)
        const nextChar = pickRandomWeight(ngramInfo, strengthenChars);

        if (nextChar == null) {
            break;
        }
        word += nextChar;
    }
    return word;
}

// @ts-ignore
export const chain = import('../corpus/google-10000-english.txt?raw').then(({ default: corpus }) => {
    corpus.toLowerCase();
    const words = corpus.replace(/\n/g, ' ').toLowerCase().split(' ')

    return train({ngrams: {}}, words);
    // chain = limitChars(chain, 'arstneio'.split(''));
    // const newWords = Array.from({length: 80}, () => generateWord(chain, 'h'.split(''), 5, 10));
});