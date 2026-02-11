package main

import (
	"math/rand"
)

// NameGenerator generates unique spirit names.
type NameGenerator interface {
	Generate(index int) string
}

// CombinatorialNameGen generates names by combining adjectives and nouns.
// Produces up to len(adjectives) * len(nouns) unique names.
type CombinatorialNameGen struct {
	pairs []string
}

var defaultAdjectives = []string{
	"Swift", "Bright", "Silent", "Wild", "Gentle",
	"Misty", "Golden", "Crystal", "Ember", "Lunar",
	"Verdant", "Frost", "Crimson", "Azure", "Velvet",
	"Nimble", "Hollow", "Radiant", "Dusky", "Coral",
	"Ivory", "Amber", "Silver", "Scarlet", "Cobalt",
	"Opal", "Sage", "Rusty", "Ashen", "Violet",
	"Mossy", "Stormy", "Pale", "Tidal", "Phantom",
	"Noble", "Solar", "Wispy", "Dappled", "Rustic",
}

var defaultNouns = []string{
	"River", "Star", "Leaf", "Stone", "Flame",
	"Cloud", "Frost", "Shadow", "Breeze", "Tide",
	"Bloom", "Spark", "Fern", "Crest", "Glen",
	"Pearl", "Thorn", "Drift", "Petal", "Brook",
	"Ember", "Gale", "Dusk", "Shard", "Vale",
	"Mist", "Reed", "Flare", "Coral", "Hollow",
	"Ridge", "Wisp", "Grove", "Plume", "Shoal",
	"Spire", "Dawn", "Rune", "Moss", "Quill",
}

// NewCombinatorialNameGen creates a name generator with shuffled adjective-noun pairs.
func NewCombinatorialNameGen() *CombinatorialNameGen {
	pairs := make([]string, 0, len(defaultAdjectives)*len(defaultNouns))
	for _, adj := range defaultAdjectives {
		for _, noun := range defaultNouns {
			pairs = append(pairs, adj+noun)
		}
	}
	rand.Shuffle(len(pairs), func(i, j int) {
		pairs[i], pairs[j] = pairs[j], pairs[i]
	})
	return &CombinatorialNameGen{pairs: pairs}
}

// Generate returns a unique name for the given index.
// Panics if index >= total combinations.
func (g *CombinatorialNameGen) Generate(index int) string {
	if index >= len(g.pairs) {
		panic("CombinatorialNameGen: index out of range; too many spirits requested")
	}
	return g.pairs[index]
}

// MaxNames returns the total number of unique names available.
func (g *CombinatorialNameGen) MaxNames() int {
	return len(g.pairs)
}
