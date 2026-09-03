data remove storage math: internal.noise
data modify storage math: internal.noise.base_x set compute default float math:.common/noise/input_x
data modify storage math: internal.noise.base_y set compute default float math:.common/noise/input_y
data modify storage math: internal.noise.base_z set compute default float math:.common/noise/input_z
data modify storage math: internal.noise.base_seed set from storage math: seed
function math:vanilla_like_terrain/1.climate
function math:vanilla_like_terrain/2.sloped_cheese
function math:vanilla_like_terrain/3.caves
function math:vanilla_like_terrain/4.final
data remove storage math: internal.noise
