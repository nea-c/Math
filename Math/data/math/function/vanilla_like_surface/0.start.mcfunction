data remove storage math: internal.noise
data modify storage math: internal.noise.base_x set from storage math: a
data modify storage math: internal.noise.base_y set value 0.0f
data modify storage math: internal.noise.base_z set from storage math: b
data modify storage math: internal.noise.base_seed set from storage math: seed
data modify storage math: internal.noise.surface.y_scale set value 1.0f
function math:.common/noise/surface_climate
function math:.common/noise/surface_search
data modify storage math: ans set compute default float math:.common/noise/surface/result
data remove storage math: internal.noise
