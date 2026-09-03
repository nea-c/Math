data modify storage math: internal.noise.terrain.scale_x set value 0.125f
data modify storage math: internal.noise.terrain.scale_y set value 0.0f
data modify storage math: internal.noise.terrain.scale_z set value 0.125f
data modify storage math: internal.noise.terrain.seed_offset set value 11000.0f
function math:.common/noise/terrain_sample
data modify storage math: internal.noise.terrain.continents set from storage math: internal.noise.sample_output
data modify storage math: internal.noise.terrain.scale_x set value 0.25f
data modify storage math: internal.noise.terrain.scale_y set value 0.0f
data modify storage math: internal.noise.terrain.scale_z set value 0.25f
data modify storage math: internal.noise.terrain.seed_offset set value 12000.0f
function math:.common/noise/terrain_sample
data modify storage math: internal.noise.terrain.erosion set from storage math: internal.noise.sample_output
data modify storage math: internal.noise.terrain.scale_x set value 0.4f
data modify storage math: internal.noise.terrain.scale_y set value 0.0f
data modify storage math: internal.noise.terrain.scale_z set value 0.4f
data modify storage math: internal.noise.terrain.seed_offset set value 13000.0f
function math:.common/noise/terrain_sample
data modify storage math: internal.noise.terrain.ridges set from storage math: internal.noise.sample_output
data modify storage math: internal.noise.terrain.ridges_folded set compute default float math:.common/noise/terrain/ridges_folded
data modify storage math: internal.noise.terrain.land set compute default float math:.common/noise/terrain/land
data modify storage math: internal.noise.terrain.erosion_low set compute default float math:.common/noise/terrain/erosion_low
data modify storage math: internal.noise.terrain.ridge_peak set compute default float math:.common/noise/terrain/ridge_peak
data modify storage math: internal.noise.terrain.near_zero_ridge set compute default float math:.common/noise/terrain/near_zero_ridge
data modify storage math: internal.noise.terrain.mountain set compute default float math:.common/noise/terrain/mountain
data modify storage math: internal.noise.terrain.offset set compute default float math:.common/noise/terrain/offset
data modify storage math: internal.noise.terrain.factor set compute default float math:.common/noise/terrain/factor
data modify storage math: internal.noise.terrain.jaggedness set compute default float math:.common/noise/terrain/jaggedness
data modify storage math: internal.noise.terrain.depth_y set compute default float math:.common/noise/terrain/depth_y
data modify storage math: internal.noise.terrain.depth set compute default float math:.common/noise/terrain/depth
