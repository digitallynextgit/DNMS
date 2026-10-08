// Each word adds log2(WORDLIST.length) bits (~10.7 for ~1,700 words). Keep words unique and
// lowercase, 3-7 letters a-z (the tests check).

const WORDS = `
able about above acid acorn acre act actor adapt add admit adopt adult after again agent agree
ahead aid aim air aisle alarm album alert algae alike alive alley allow almond aloe alone along
aloud alpha amaze amber amount ample amuse anchor angle ankle annual answer ant anvil apart apple
apron arch arena argue arm aroma arrive arrow art artist ash aside ask asleep atlas atom attach
attic audio august aunt autumn avenue avoid awake award aware axis
baby back bacon badge bag bagel bake baker bakery balance ball ballet bamboo banana band bangle
bank banner barley barn barrel base basil basin basket batch bath beach beacon bead beak beam bean
bear beard beat beauty bed bee beef beetle begin bell belt bench berry best bike bird birth
biscuit bison black blade blank blanket blaze blend bless blink block bloom blossom blouse blue
blush board boat body boil bold bolt bonus book boost boot booth border born boss both bottle
bounce bowl box brain brake branch brand brass brave bread break breeze brick bridge brief bright
bring brisk broad brook broom brother brown brush bubble bucket buddy budget buffalo build bulb
bunch bundle bunny burger burrow bus bush busy butter button buyer buzz
cabin cable cactus cake calf call calm camel camera camp canal candle candy canoe canvas canyon
cap cape card cargo carpet carrot cart carve case cash castle cat catch cattle cause cave cedar
celery cell cement cereal chain chair chalk champ change chant chapel charm chart chase cheap
check cheek cheer cheese chef cherry chess chest chew chick chief child chili chill chimney chin
chip chirp choice choir chop chord chorus cider cinema circle circus citrus city civic claim clam
clap class claw clay clean clear clerk clever click client cliff climb clinic clip cloak clock
close cloth cloud clover clown club clue coach coal coast coat cobalt cocoa coconut code coffee
coin cold collar colony column comb comet comic common cook cookie cool copper copy coral cord
core corn corner cotton couch count county couple course court cousin cover cow cozy crab craft
crane crate crayon cream credit creek crew cricket crisp crop cross crowd crown crumb crunch crust
cube cuddle cup cupcake curb cure curl curry curve cushion custom cycle
daily dairy daisy dance dancer dash data date dawn day deal debate decade decent deck decor deep
deer degree delay delta demand denim dense depot depth derby desert design desk detail dew dial
diary dice diet digit dime diner dinner dip direct dish disk dive diver dizzy dock doctor dog doll
dollar dolphin domain dome donkey donut door dot double dough dove down dozen draft dragon drain
drama drawer dream dress drift drill drink drive drop drum dry duck dune dust dusty duty
eager eagle ear early earn earth easel east easy echo edge edit effort egg eight elbow elder elect
elegant element elf elk elm else ember emerge empty emu enable end energy engine enjoy enough
enter entry envoy equal era errand essay estate even event ever exact exam excel exit expert extra
eye
fable fabric face fact factor fair fairy faith falcon fall fame family fan fancy far farm farmer
fast father fawn feast feather fee feed feel fellow fence fern ferry few field fig figure file
fill film filter final finch find fine finger finish fire firm first fish fit five fix flag flake
flame flash flask flat fleet flight flint flip float flock flood floor flour flow flower fluffy
flute fly foam focus fog foil fold folk follow food foot forest forge fork form fort forty forum
fossil found fox frame free fresh friend frog front frost fruit fuel full fun fund funny fur
future
gadget galaxy gallery game garage garden garlic gate gather gauge gear gecko gem gentle genius
giant gift ginger giraffe give glad glass glide globe glory glove glow glue goal goat gold golden
golf good goose gorilla grab grace grade grain grand grant grape graph grass gravel gravy great
green grid grill grin grip grocery ground group grove grow guard guava guess guest guide guitar
gulf gum guru gym
habit hair half hall halo hammer hammock hand handle happy hard harvest hat hatch have hawk hay
hazel head health heap heart heat heaven hedge height hello helmet help hen herb herd hero heron
hidden high hike hill hint hip hippo hobby hockey hold hole holiday hollow home honest honey hood
hook hope horn horse host hotel hour house hover hub hug huge human humble hundred hunt hurry hut
ice icicle icon idea ideal idle igloo image impact import inch income index indoor infant ink
inlet inner input insect inside invite iron island issue item ivory ivy
jacket jaguar jam jar jasmine jazz jeans jelly jersey jet jewel job jockey jog join joke jolly
journal joy judge juice jumbo jump jungle junior jury just
kale kayak keen keep kettle key keypad kick kid kind king kiosk kite kitten kiwi knee knife knit
knock knot know koala
label lace ladder lady lake lamb lamp land lane laptop large laser last latch late laugh lava lawn
layer lazy lead leaf league lean learn least leather leave ledge lemon lend length lens lentil
leopard lesson letter level lever library lid life lift light lilac lily limb lime limit line
linen lion lip liquid list listen little live lizard load loaf lobby local lock lodge loft logic
long loop lotus loud lounge love loyal lucky lumber lunar lunch lyric
machine magic magnet maid mail main major make mall mango manor map maple marble march margin
marine market marsh mask match mate math matter maze meadow meal measure meat medal media medium
meet melody melon member memo memory mentor menu mercy merit mesa mesh metal method middle mild
mile milk mill mind mineral mint minute mirror mist mitten mix mixer mobile model modern moment
money monkey month mood moon moose morning moss motel moth motion motor mount mouse mouth move
movie much mud muffin mug mule museum music mustard mutual myth
nail name napkin narrow nation native nature navy near neat neck nectar needle neon nephew nerve
nest net never new news next nice niece night nine noble nod noise noodle normal north nose note
notice novel number nurse nut nutmeg nylon
oak oasis oat object ocean octave octopus odd offer office often oil okay old olive omega onion
online open opera option orange orbit orchard orchid order organ origin other otter ounce outer
output oval oven over owl owner oxygen oyster
pace pack packet pad paddle page pail paint pair palace palm pan panda panel paper parade parcel
parent park parrot part party pass past pasta paste patch path patio pause paw peace peach peak
peanut pear pearl pebble pecan pedal peel pen pencil people pepper perch period person pet petal
phone photo piano pick picnic piece pier pig pigeon pillow pilot pine pink pint pipe pitch pizza
place plain plan plane planet plant plate play plaza plenty plot plum plume plus pocket poem poet
point polar pole polish pond pony pool poppy porch port pose post pot potato pouch powder power
press price pride prince print prize prompt proof proud prune public pull pulse pump punch puppy
purple purse push puzzle
quail quaint quartz queen query quest quick quiet quilt quiz quote
rabbit raccoon race rack radar radio raft rail rain rainbow raise raisin rake rally ramp ranch
random range rapid rare raven raw razor reach read ready real rebel recipe record red reef region
relax relay relish remote rent repair reply report rescue rest result retro return review reward
rhyme rhythm rib ribbon rice rich ride ridge right ring ripple rise river road roast robe robin
robot rock rocket rodeo roll roof room root rope rose rotate rough round route royal rubber ruby
rug ruler rumble run rural rush rustic
saddle safari safe saga sail salad salmon salon salt salute same sample sand sandal satin sauce
sauna save scale scarf scene school science scoop scooter score scout screen script scroll sea
seal season seat second secret seed seek select sense series serve set settle seven shade shadow
shake shape share shark sharp shed sheep shelf shell shield shift shine ship shirt shoe shop shore
short shovel show shower shrimp shrub side sign signal silk silver simple sing single sink siren
sister sit six size skate sketch ski skill skin skirt sky slate sled sleep slice slide slim slope
slow small smart smile snack snail snake snap snow soap soccer social sock sofa soft soil solar
solid solo song sort sound soup south space spark speak spice spider spin spirit splash spoon
sport spot spray spring sprout square squash stable stack staff stage stair stamp stand star start
state station stay steak steam steel stem step stereo stick still stone stool stop store storm
story stove straw stream street stripe strong studio study style sugar suit summer summit sun
sunny sunset super supper supply surf survey sweet swift swim swing switch symbol syrup system
table tablet tackle taco tail talent talk tall tank tape target task taste taxi tea teach team
teapot tennis tent term test text thank theme thick thing third thorn thread three thumb thunder
ticket tide tidy tiger tile timber time tiny tip tire title toast today toe toffee token tomato
tone tongue tool tooth top topic torch total touch tour towel tower town toy track trade trail
train trap travel tray treat tree trend trial tribe trick trim trip trophy truck true trumpet
trunk trust truth tulip tuna tune tunnel turkey turn turtle tutor twin twist type
umpire uncle under union unique unit until update upper urban urge usual
vacuum valley value van vanilla vase vast vector velvet vendor venue verb verse vessel vest video
view villa village vine violet violin visit visual vital vivid vocal voice volume vote voyage
wafer wagon waist wait wake walk wall walnut wand want warm wash wasp watch water wave wax way
wealth wear weave web wedge week weekend weight welcome well west whale wheat wheel whisk whistle
white whole wide width wild will willow win wind window wing winner winter wire wisdom wise wish
wizard wolf wonder wood wool word work world worm wrap wreath wrist write
yacht yard yarn year yeast yellow yes yield yoga yogurt young youth yummy
zebra zero zest zigzag zinc zipper zone zoo zoom
`

export const WORDLIST: readonly string[] = WORDS.trim().split(/\s+/)
