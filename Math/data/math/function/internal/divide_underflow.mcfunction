data modify storage math: ans set value 0.0f
execute if data storage math:internal {w_divide_sign:-1.0f} run data modify storage math: ans set value -0.0f
return 1
