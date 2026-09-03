data remove storage math: internal.noise
data modify storage math: internal.noise.base_x set from storage math: a
data modify storage math: internal.noise.base_z set from storage math: b
data modify storage math: internal.noise.base_seed set from storage math: seed
function math:.common/noise/surface_generate
data remove storage math: internal.noise
