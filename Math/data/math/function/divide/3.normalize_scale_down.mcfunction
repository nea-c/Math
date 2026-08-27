data modify storage math:internal x set compute default math:internal/reciprocal/half_x
data modify storage math:internal y set compute default math:internal/divide/normalize/increment_exponent
return run function math:divide/1.normalize
