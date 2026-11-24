#!/bin/bash
# LANTERN TOWN の 3D 素材 (games/lantern-town/assets/*.glb) を KayKit の配布ファイルから作り直す。
#
#   ./tools/lantern-town-assets.sh <KayKit を clone したフォルダ>
#
# 素材は Kay Lousberg さんの KayKit (CC0)。GitHub の無料版を使っている。
#   git clone https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 City-Builder-Bits
# のように、下の 8 つを同じフォルダに clone してから実行する。
#   City-Builder-Bits Halloween-Bits Furniture-Bits Restaurant-Bits Prototype-Bits
#   Character-Pack-Adventures Character-Pack-Skeletons
# パックごとに 1 つの GLB へまとめ、キャラクターは「体」と「動き」を別のファイルに分ける。
# 全キャラが同じ骨組みなので、動きは 1 つのファイルを全員で使い回せる。
set -euo pipefail

SRC="${1:?KayKit を clone したフォルダを指定してください}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/games/lantern-town/assets"
PACK=(python3 -I "$ROOT/tools/kaykit-pack.py")
mkdir -p "$OUT"

dir() { echo "$SRC/$1/addons/"*"/$2"; }
pick() { local d; d="$(dir "$1" Assets/gltf)"; shift; for n in "$@"; do echo "$d/$n.gltf"; done; }

# 街 (ベース無しの建物は使わない)
"${PACK[@]}" "$OUT/city.glb" $(ls "$(dir City-Builder-Bits Assets/gltf)"/*.gltf | grep -v withoutBase)
"${PACK[@]}" "$OUT/halloween.glb" "$(dir Halloween-Bits Assets/gltf)"/*.gltf
"${PACK[@]}" "$OUT/furniture.glb" "$(dir Furniture-Bits Assets/gltf)"/*.gltf
"${PACK[@]}" "$OUT/restaurant.glb" $(pick Restaurant-Bits \
  chair_A chair_B crate crate_lid crate_buns crate_cheese crate_lettuce crate_tomatoes crate_potatoes crate_carrots crate_steak \
  cuttingboard dishrack_plates door_A extractorhood floor_kitchen fridge_A kitchencabinet \
  kitchencounter_straight_A kitchencounter_straight_B kitchencounter_sink kitchencounter_straight_decorated \
  ketchup mustard menu oven pan_A plate pot_A pot_A_stew stove_multi table_round_A table_round_A_small \
  wall wall_doorway wall_window_open wall_orderwindow wall_decorated shelf_papertowel_decorated papertowel \
  food_burger food_stew food_vegetableburger food_ingredient_bun \
  food_ingredient_burger_uncooked food_ingredient_burger_cooked food_ingredient_burger_trash \
  food_ingredient_cheese food_ingredient_cheese_slice food_ingredient_lettuce food_ingredient_lettuce_slice \
  food_ingredient_tomato food_ingredient_tomato_slice food_ingredient_potato food_ingredient_potato_chopped \
  food_ingredient_carrot food_ingredient_carrot_chopped)
"${PACK[@]}" "$OUT/prototype.glb" $(pick Prototype-Bits \
  Barrel_A Barrel_B Barrel_C Box_A Box_B Box_C Coin_A Dummy_Base target target_stand_A target_stand_A_Decorated \
  target_wall_large_A Pallet_Small_Decorated_A Pallet_Small_Decorated_B table_medium_Decorated Pillar_A)
"${PACK[@]}" "$OUT/skeleton-weapons.glb" $(pick Character-Pack-Skeletons \
  Skeleton_Blade Skeleton_Axe Skeleton_Staff Skeleton_Crossbow Skeleton_Shield_Small_A Skeleton_Arrow)

# キャラクターの体 (動きは捨てる)
for c in Knight Barbarian Mage Rogue Rogue_Hooded; do
  "${PACK[@]}" "$OUT/$c.glb" "$(dir Character-Pack-Adventures Characters/gltf)/$c.glb"
done
for c in Skeleton_Minion Skeleton_Warrior Skeleton_Rogue Skeleton_Mage; do
  "${PACK[@]}" "$OUT/$c.glb" "$(dir Character-Pack-Skeletons Characters/gltf)/$c.glb"
done

# 動き。共通の動きは Knight から、ガイコツだけの動きは Skeleton_Minion から取る。
"${PACK[@]}" --anims-only --keep "Idle,Walking_A,Walking_B,Running_A,Walking_Backwards,\
1H_Melee_Attack_Chop,1H_Melee_Attack_Slice_Diagonal,1H_Melee_Attack_Slice_Horizontal,1H_Melee_Attack_Stab,\
2H_Melee_Attack_Chop,2H_Melee_Attack_Slice,2H_Melee_Attack_Spin,2H_Melee_Idle,\
Block,Blocking,Block_Hit,Block_Attack,Dodge_Forward,Dodge_Backward,Hit_A,Hit_B,Death_A,Death_B,\
Cheer,Interact,PickUp,Use_Item,Sit_Chair_Down,Sit_Chair_Idle,Sit_Chair_StandUp,Lie_Down,Lie_Idle,Lie_StandUp,\
Sit_Floor_Idle,Spellcast_Shoot,Spellcast_Long,1H_Ranged_Shoot,Throw,Unarmed_Idle,Jump_Full_Short" \
  "$OUT/anims.glb" "$(dir Character-Pack-Adventures Characters/gltf)/Knight.glb"
"${PACK[@]}" --anims-only --keep "Skeletons_Awaken_Floor,Skeletons_Inactive_Floor_Pose,Walking_D_Skeletons,\
Running_C,Idle_Combat,Taunt,1H_Melee_Attack_Jump_Chop,Death_C_Skeletons,Spawn_Ground_Skeletons,Spellcast_Summon" \
  "$OUT/anims-skeleton.glb" "$(dir Character-Pack-Skeletons Characters/gltf)/Skeleton_Minion.glb"

du -sh "$OUT"
