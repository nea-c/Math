data modify storage math: internal.noise.surface.scale set value 0.005f
data modify storage math: internal.noise.surface.seed_offset set value 11000.0f
function math:.common/noise/surface_sample
data modify storage math: internal.noise.surface.continents set from storage math: internal.noise.simplex2d_output
data modify storage math: internal.noise.surface.scale set value 0.008f
data modify storage math: internal.noise.surface.seed_offset set value 12000.0f
function math:.common/noise/surface_sample
data modify storage math: internal.noise.surface.erosion set from storage math: internal.noise.simplex2d_output
data modify storage math: internal.noise.surface.scale set value 0.01f
data modify storage math: internal.noise.surface.seed_offset set value 13000.0f
function math:.common/noise/surface_sample
data modify storage math: internal.noise.surface.ridges set from storage math: internal.noise.simplex2d_output
data modify storage math: internal.noise.surface.ridges_folded set compute default float math:.common/noise/surface/ridges_folded
data modify storage math: internal.noise.surface.land_t set compute default float math:.common/noise/surface/land_t
data modify storage math: internal.noise.surface.ocean_t set compute default float math:.common/noise/surface/ocean_t
data modify storage math: internal.noise.surface.low_erosion_t set compute default float math:.common/noise/surface/low_erosion_t
data modify storage math: internal.noise.surface.ridge_t set compute default float math:.common/noise/surface/ridge_t
data modify storage math: internal.noise.surface.land set compute default float math:.common/noise/surface/land
data modify storage math: internal.noise.surface.ocean set compute default float math:.common/noise/surface/ocean
data modify storage math: internal.noise.surface.low_erosion set compute default float math:.common/noise/surface/low_erosion
data modify storage math: internal.noise.surface.ridge_peak set compute default float math:.common/noise/surface/ridge_peak
data modify storage math: internal.noise.surface.mountain_base set compute default float math:.common/noise/surface/mountain_base
data modify storage math: internal.noise.surface.ridge_broad set compute default float math:.common/noise/surface/ridge_broad
data modify storage math: internal.noise.surface.mountain_height set compute default float math:.common/noise/surface/mountain_height
data modify storage math: internal.noise.surface.rolling set compute default float math:.common/noise/surface/rolling
data modify storage math: ans set compute default float math:.common/noise/surface/height
