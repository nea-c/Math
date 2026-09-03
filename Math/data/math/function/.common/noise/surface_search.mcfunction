data modify storage math: internal.noise.surface.estimate set compute default float math:.common/noise/surface/estimate
data modify storage math: internal.noise.surface.y set from storage math: internal.noise.surface.estimate
function math:.common/noise/surface_density_sample
data modify storage math: internal.noise.surface.first_correction set compute default float math:.common/noise/surface/first_correction
data modify storage math: internal.noise.surface.candidate set compute default float math:.common/noise/surface/candidate
data modify storage math: internal.noise.surface.y set from storage math: internal.noise.surface.candidate
function math:.common/noise/surface_density_sample
data modify storage math: internal.noise.surface.correction set compute default float math:.common/noise/surface/correction_negative_raw
execute if predicate math:.common/noise/surface/sloped_raw_nonnegative run data modify storage math: internal.noise.surface.correction set compute default float math:.common/noise/surface/correction_positive_raw
