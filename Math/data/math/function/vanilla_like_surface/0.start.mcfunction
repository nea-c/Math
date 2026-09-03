data remove storage math: internal.noise
data modify storage math: internal.noise.base_x set from storage math: a
data modify storage math: internal.noise.base_y set value 0.0f
data modify storage math: internal.noise.base_z set from storage math: b
data modify storage math: internal.noise.base_seed set from storage math: seed
function math:.common/noise/surface_climate
data modify storage math: ans set compute default float math:.common/noise/surface/height
data remove storage math: internal.noise
