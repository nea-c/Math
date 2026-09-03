data remove storage math: internal.noise
data modify storage math: internal.noise.base_x set compute default float math:.common/noise/surface/input_x
data modify storage math: internal.noise.base_y set value 0.0f
data modify storage math: internal.noise.base_z set compute default float math:.common/noise/surface/input_z
data modify storage math: internal.noise.base_seed set from storage math: seed
data modify storage math: internal.noise.surface.y_scale set compute default float math:.common/noise/surface/frequency
function math:.common/noise/surface_climate
function math:.common/noise/surface_search
data modify storage math: ans set compute default float math:.common/noise/surface/result
data remove storage math: internal.noise
