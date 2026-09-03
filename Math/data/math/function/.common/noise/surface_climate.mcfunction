data modify storage math: internal.noise.terrain.scale_x set value 0.00125f
data modify storage math: internal.noise.terrain.scale_y set value 0.0f
data modify storage math: internal.noise.terrain.scale_z set value 0.00125f
data modify storage math: internal.noise.terrain.seed_offset set value 11000.0f
function math:.common/noise/terrain_sample
data modify storage math: internal.noise.terrain.continents_raw set from storage math: internal.noise.sample_output
data modify storage math: internal.noise.terrain.continents set compute default float math:.common/noise/terrain/continents_scaled
data modify storage math: internal.noise.terrain.scale_x set value 0.0025f
data modify storage math: internal.noise.terrain.scale_y set value 0.0f
data modify storage math: internal.noise.terrain.scale_z set value 0.0025f
data modify storage math: internal.noise.terrain.seed_offset set value 12000.0f
function math:.common/noise/terrain_sample
data modify storage math: internal.noise.terrain.erosion_raw set from storage math: internal.noise.sample_output
data modify storage math: internal.noise.terrain.erosion set compute default float math:.common/noise/terrain/erosion_scaled
data modify storage math: internal.noise.terrain.scale_x set value 0.004f
data modify storage math: internal.noise.terrain.scale_y set value 0.0f
data modify storage math: internal.noise.terrain.scale_z set value 0.004f
data modify storage math: internal.noise.terrain.seed_offset set value 13000.0f
function math:.common/noise/terrain_sample
data modify storage math: internal.noise.terrain.ridges_raw set from storage math: internal.noise.sample_output
data modify storage math: internal.noise.terrain.ridges set compute default float math:.common/noise/terrain/ridges_scaled
data modify storage math: internal.noise.terrain.ridges_folded set compute default float math:.common/noise/terrain/ridges_folded
data modify storage math: internal.noise.terrain.land set compute default float math:.common/noise/terrain/land
data modify storage math: internal.noise.terrain.erosion_low set compute default float math:.common/noise/terrain/erosion_low
data modify storage math: internal.noise.terrain.ridge_peak set compute default float math:.common/noise/terrain/ridge_peak
data modify storage math: internal.noise.terrain.near_zero_ridge set compute default float math:.common/noise/terrain/near_zero_ridge
data modify storage math: internal.noise.terrain.mountain set compute default float math:.common/noise/terrain/mountain
data modify storage math: internal.noise.terrain.ridge_positive set compute default float math:.common/noise/terrain/ridge_positive
data modify storage math: internal.noise.terrain.ocean_to_coast set compute default float math:.common/noise/terrain/ocean_to_coast
data modify storage math: internal.noise.terrain.coast_to_land set compute default float math:.common/noise/terrain/coast_to_land
data modify storage math: internal.noise.terrain.base_land set compute default float math:.common/noise/terrain/base_land
data modify storage math: internal.noise.terrain.rolling set compute default float math:.common/noise/terrain/rolling
data modify storage math: internal.noise.terrain.hills set compute default float math:.common/noise/terrain/hills
data modify storage math: internal.noise.terrain.continent_spline set compute default float math:.common/noise/terrain/continent_spline
data modify storage math: internal.noise.terrain.offset set compute default float math:.common/noise/terrain/offset
data modify storage math: internal.noise.terrain.ridge_signed set compute default float math:.common/noise/terrain/ridge_signed
data modify storage math: internal.noise.terrain.jagged_sign set compute default float math:.common/noise/terrain/jagged_sign
data modify storage math: internal.noise.terrain.jaggedness set compute default float math:.common/noise/terrain/jaggedness
data modify storage math: internal.noise.terrain.jagged_noise set compute default float math:.common/noise/terrain/jagged_noise_approx
data modify storage math: internal.noise.terrain.jagged_half_negative set compute default float math:.common/noise/terrain/jagged_half_negative
